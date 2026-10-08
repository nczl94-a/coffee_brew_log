// Persistence layer: everything lives in localStorage under one key.
const Store = (() => {
  const KEY = 'brewlog.v1';
  let data = load();

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

  function upsert(list, item) {
    if (!item.id) {
      item.id = uid();
      item.createdAt = new Date().toISOString();
      list.push(item);
    } else {
      const i = list.findIndex(x => x.id === item.id);
      if (i >= 0) list[i] = { ...list[i], ...item };
      else list.push(item);
    }
    save();
    return item;
  }

  return {
    get beans() { return data.beans; },
    get brews() { return data.brews; },
    bean: id => data.beans.find(b => b.id === id),
    brew: id => data.brews.find(b => b.id === id),
    saveBean: b => upsert(data.beans, b),
    saveBrew: b => upsert(data.brews, b),
    deleteBean(id) { data.beans = data.beans.filter(b => b.id !== id); save(); },
    deleteBrew(id) { data.brews = data.brews.filter(b => b.id !== id); save(); },
    toggleFavourite(kind, id) {
      const item = kind === 'bean' ? this.bean(id) : this.brew(id);
      if (!item) return false;
      item.favourite = !item.favourite;
      save();
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
      return { beans: obj.beans.length, brews: obj.brews.length };
    },
    persisted: save,
  };
})();
