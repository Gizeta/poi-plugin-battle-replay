const fs = require('fs-extra');
const path = require('path-extra');
const zlib = require('zlib');
const promisify = require('bluebird').promisify;

const readDirAsync = promisify(fs.readdir);
const readFileAsync = promisify(fs.readFile);
const unzipAsync = promisify(zlib.unzip);

const GZIP_EXT = '.gz';
const APPDATA = path.join(window.APPDATA_PATH, 'battle-detail');

let loadFile = (name) => {
    if (!name) return;

    let fpath = path.join(APPDATA, name);
    return readFileAsync(fpath)
        .then((data) => {
            if (path.parse(name).ext === GZIP_EXT) {
                return unzipAsync(data);
            }
            return Promise.resolve(data);
        })
        .then((data) => {
            return Promise.resolve(data.toString());
        })
        .catch((err) => {
            if (err.code !== 'ENOENT') throw err;
        });
}

module.exports = {
    getId: (battle) => {
        if (battle == null) return;
        return battle.time || battle.poi_timestamp;
    },

    getTime: (battle) => {
        if (battle == null) return;
        let str = '';
        if (battle.time) {
            let date = new Date(battle.time);
            date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
            str = date.toISOString().slice(0, 19).replace('T', ' ');
        }
        return str;
    },

    getMap: (battle) => {
        if (battle == null) return;
        if (battle.type === 'Pratice') return 'Pratice';

        let map = battle.map;
        if (map instanceof Array && map.length > 0) {
            return `${map[0]}-${map[1]} (${battle.type === 'Boss' ? 'Boss' : map[2]})`;
        }
    },

    loadBattle: (id) => {
        if (!id) return;
        
        return loadFile(`${id}.json${GZIP_EXT}`)
            .then((data) => {
                if (!data) return;
                return Promise.resolve(JSON.parse(data));
            })
            .catch((err) => {
                console.error(`Failed to load battle ${id}.`, '\n', err.stack);
            });
    },

    listBattle: () => {
        const BATTLE_REGEXP = /^(\d+)\.json/;
        let ids = [];
        return readDirAsync(APPDATA)
            .then((files) => {
                files.map((file, i) => {
                    let match = file.match(BATTLE_REGEXP);
                    if (match && match[1]) {
                        ids.push(parseInt(match[1]));
                    }
                });
                return Promise.resolve(ids);
            });
    },
}
