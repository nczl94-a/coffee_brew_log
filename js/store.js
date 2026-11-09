// Persistence layer. Data is mirrored in localStorage under one key, so the app opens instantly and
// works without an account. When signed in, Firestore (users/{uid}/beans, users/{uid}/brews) is the
// source of truth: it syncs across devices and queues writes while offline.
const Store = (() => {
  const KEY = 'brewlog.v1';
  const MIGRATED_KEY = 'brewlog.migratedUid'; // uid whose cloud copy already holds this device's local data
  let data = load();
  let user = null;
  let unsubs = [];
  const changeListeners = [];
  const authListeners = [];

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && Array.isArray(d.brews) && Array.isArray(d.beans)) return d;
    } catch (e) { /* fall through to empty */ }
    return { beans: [], brews: [] };
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  // ---------- cloud ----------
  let auth = null, db = null;
  try {
    if (window.firebase && typeof FIREBASE_CONFIG !== 'undefined') {
      firebase.initializeApp(FIREBASE_CONFIG);
      auth = firebase.auth();
      db = firebase.firestore();
      db.settings({ ignoreUndefinedProperties: true, merge: true });
      // Offline cache + write queue. Fails in some private modes; Firestore then runs memory-only.
      db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
      auth.onAuthStateChanged(onAuth);
    }
  } catch (e) {
    console.warn('Cloud sync unavailable', e);
    auth = db = null;
  }

  const warn = e => console.warn('Sync error', e);
  const col = kind => db.collection('users').doc(user.uid).collection(kind);
  const put = (kind, item) => { if (user) col(kind).doc(item.id).set(item).catch(warn); };
  const remove = (kind, id) => { if (user) col(kind).doc(id).delete().catch(warn); };

  // Writes are applied to Firestore's local cache immediately; commits resolve once the server has them.
  function uploadAll(beans, brews) {
    const writes = [...beans.map(b => ['beans', b]), ...brews.map(b => ['brews', b])].filter(([, x]) => x && x.id);
    for (let i = 0; i < writes.length; i += 400) {
      const batch = db.batch();
      writes.slice(i, i + 400).forEach(([kind, item]) => batch.set(col(kind).doc(item.id), item));
      batch.commit().catch(warn);
    }
  }

  function onAuth(u) {
    unsubs.forEach(f => f());
    unsubs = [];
    user = u;
    if (u) {
      // First sign-in on this device: merge what's already here into the account.
      if (localStorage.getItem(MIGRATED_KEY) !== u.uid) {
        uploadAll(data.beans, data.brews);
        try { localStorage.setItem(MIGRATED_KEY, u.uid); } catch (e) { /* retried next sign-in */ }
      }
      ['beans', 'brews'].forEach(kind => {
        unsubs.push(col(kind).onSnapshot(snap => {
          // An empty cache on a fresh device isn't the real answer; wait for the server.
          if (snap.empty && snap.metadata.fromCache) return;
          data[kind] = snap.docs.map(d => d.data());
          save();
          changeListeners.forEach(f => f());
        }, warn));
      });
    }
    authListeners.forEach(f => f(u));
  }

  function upsert(kind, item) {
    const list = data[kind];
    let stored = item;
    if (!item.id) {
      item.id = uid();
      item.createdAt = new Date().toISOString();
      list.push(item);
    } else {
      const i = list.findIndex(x => x.id === item.id);
      if (i >= 0) stored = list[i] = { ...list[i], ...item };
      else list.push(item);
    }
    save();
    put(kind, stored);
    return item;
  }

  return {
    get beans() { return data.beans; },
    get brews() { return data.brews; },
    bean: id => data.beans.find(b => b.id === id),
    brew: id => data.brews.find(b => b.id === id),
    saveBean: b => upsert('beans', b),
    saveBrew: b => upsert('brews', b),
    deleteBean(id) { data.beans = data.beans.filter(b => b.id !== id); save(); remove('beans', id); },
    deleteBrew(id) { data.brews = data.brews.filter(b => b.id !== id); save(); remove('brews', id); },
    toggleFavourite(kind, id) {
      const item = kind === 'bean' ? this.bean(id) : this.brew(id);
      if (!item) return false;
      item.favourite = !item.favourite;
      save();
      put(kind === 'bean' ? 'beans' : 'brews', item);
      return item.favourite;
    },
    exportJSON() {
      return JSON.stringify({ app: 'brew-log', version: 1, exportedAt: new Date().toISOString(), ...data }, null, 2);
    },
    // Merge an export into current data; items with the same id are replaced.
    importJSON(obj) {
      if (!obj || !Array.isArray(obj.brews) || !Array.isArray(obj.beans)) throw new Error('Not a Brew Log export');
      const merge = (cur, inc) => {
        const map = new Map(cur.map(x => [x.id, x]));
        inc.filter(x => x && x.id).forEach(x => map.set(x.id, x));
        return [...map.values()];
      };
      data = { beans: merge(data.beans, obj.beans), brews: merge(data.brews, obj.brews) };
      save();
      if (user) uploadAll(obj.beans, obj.brews);
      return { beans: obj.beans.length, brews: obj.brews.length };
    },
    persisted: save,

    // ---------- account ----------
    cloudAvailable: !!auth,
    get user() { return user; },
    onChange: f => changeListeners.push(f),
    onAuth: f => authListeners.push(f),
    signInGoogle: () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()),
    signInEmail: (email, password, create) => (create
      ? auth.createUserWithEmailAndPassword(email, password)
      : auth.signInWithEmailAndPassword(email, password)),
    // Resolves true once every local change has reached the server, false if that takes longer than ms.
    flush: (ms = 4000) => Promise.race([
      db.waitForPendingWrites().then(() => true, () => false),
      new Promise(r => setTimeout(() => r(false), ms)),
    ]),
    // Signing out removes this device's copy; the data stays in the account.
    async signOut() {
      await auth.signOut();
      data = { beans: [], brews: [] };
      try { localStorage.removeItem(KEY); localStorage.removeItem(MIGRATED_KEY); } catch (e) { /* nothing stored */ }
      changeListeners.forEach(f => f());
    },
  };
})();
