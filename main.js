require(`${ROOT}/views/env`);

var async         = require('async');
var path          = require('path-extra');
var clipboard     = require('electron').clipboard;
var remote        = require('electron').remote;
var PacketManager = require('./packet');

window.i18n = {};
window.i18n.main = new(require('i18n-2'))({
    locales: ['en-US', 'ja-JP', 'zh-CN', 'zh-TW'],
    defaultLocale: 'zh-CN',
    directory: path.join(__dirname, 'i18n'),
    extension: '.json',
    updateFiles: false,
    devMode: false
});
window.i18n.main.setLocale(window.language);
window.__ = window.i18n.main.__.bind(window.i18n.main);
try {
    require('poi-plugin-translator').pluginDidLoad();  
}
catch (error) {
    console.log(error);
}
var i18n_res = window.i18n.resources = window.i18n.resources || {};
i18n_res.__ = i18n_res.__ || ((str) => str);
i18n_res.translate = i18n_res.translate || ((locale, str) => str);
i18n_res.setLocale = i18n_res.setLocale || ((str) => null);
window.__r = i18n_res.__.bind(i18n_res);

document.title = __('Battle Replay');

MAX_BATTLE_NUMBER = 64;

var battle;
var battleList = [];

window.ipc.register("BattleReplay", {
    showBattle: (packet, callback) => {
        API = wrapper(packet);
        loadCode(true);
        PAUSE = false;

        remote.getCurrentWindow().show();

        if (typeof callback === 'function') {
            callback();
        }
    }
});
window.onbeforeunload = () => {
    window.ipc.unregisterAll("BattleReplay");
}

// https://github.com/poooi/lib-battle/blob/master/docs/packet-format-2.1.md
function wrapper_v21(data) {
    var obj = {};
    obj.time = data.time / 1000;
    obj.fleetnum = data.packet[0].api_deck_id || data.packet[0].api_dock_id;
    obj.combined = data.fleet.escort ? 1 : 0;
    obj.diff = 1;
    obj.world = data.map[0];
    obj.mapnum = data.map[1];
    
    obj.fleet1 = [];
    obj.fleet2 = [];
    obj.fleet3 = [];
    obj.fleet4 = [];
    var fleet = obj.fleet1;
    for (var i = 0; i < data.fleet.main.length; i++) {
        var ship = data.fleet.main[i];
        if (ship == null) break;
        fleet.push({
            equip: ship.poi_slot.map((item) => item ? item.api_slotitem_id : -1),
            kyouka: ship.api_kyouka,
            level: ship.api_lv,
            morale: ship.api_cond,
            mst_id: ship.api_ship_id
        });
    }
    if (data.fleet.escort) {
        var fleet = obj.fleet2;
        for (var i = 0; i < data.fleet.escort.length; i++) {
            var ship = data.fleet.escort[i];
            if (ship == null) break;
            fleet.push({
                equip: ship.poi_slot.map((item) => item ? item.api_slotitem_id : -1),
                kyouka: ship.api_kyouka,
                level: ship.api_lv,
                morale: ship.api_cond,
                mst_id: ship.api_ship_id
            });
        }
    }
    if (data.fleet.support) {
        var fleet = obj.fleet3;
        for (var i = 0; i < data.fleet.support.length; i++) {
            var ship = data.fleet.support[i];
            if (ship == null) break;
            fleet.push({
                equip: ship.poi_slot.map((item) => item ? item.api_slotitem_id : -1),
                kyouka: ship.api_kyouka,
                level: ship.api_lv,
                morale: ship.api_cond,
                mst_id: ship.api_ship_id
            });
        }
    }
    
    obj.support1 = 3;
    obj.support2 = 3;
    
    obj.battles = [];
    obj.battles[0] = {
        time: data.packet[0].poi_time / 1000,
        yasen: (data.packet[1] && data.packet[1].api_hougeki) ? data.packet[1] : {},
        data: data.packet[0]
    };
    return obj;
}

function wrapper(data) {
    return wrapper_v21(data);
}

function generateOptions() {
    var selected = -1;
    var options = [];
    var selectedId = PacketManager.getId(battle);
    for (var i = 0; i < battleList.length; i++) {
        var battle = battleList[i];
        if (selectedId == PacketManager.getId(battle)) selected = i;
        options.push(
            $(`<option key="${i}" value="${i}">${PacketManager.getTime(battle)} ${PacketManager.getMap(battle)}</option>`)
        );
    }
    $('select').html(options);
    $("select").prop("selectedIndex", 0);
}

$ = jQuery;
$(document).ready(() => {
    $('.__').each((idx, elem) => { $(elem).html(__($(elem).html())); });
    
    PacketManager.listBattle().then((battleIds) => {
        if (!battleIds) {
            return;
        }
        battleIds = battleIds.reverse().slice(0, MAX_BATTLE_NUMBER); // get only MAX_BATTLE_NUMBER most recent battles
        battles = async.concatSeries(
                battleIds, 
                function(id, callback) {
                    PacketManager.loadBattle(id).then((battle) => { 
                        callback(null, [battle]); 
                    });
                }, 
                function(err, results) {
                    battleList = results;
                    generateOptions();

                    API = wrapper(battleList[0]);
                    loadCode(true);
                    PAUSE = true;
                }
        );
    });

    
    $('#play').click(() => {
        if (started)
            PAUSE = !PAUSE;
    });
    
    $('#reset').click(() => {
        if (started)
            reset(() => { processAPI(API); });
    });
    
    $('#copy').click(() => {
        clipboard.writeText(JSON.stringify(battle));
    });
    
    $('#paste').click(() => {
        API = wrapper(JSON.parse(clipboard.readText()));
        loadCode(true);
        PAUSE = true;
    });
    
    $("select").change((e) => {
        var index = parseInt(e.target.value);
        if (isNaN(index)) return;
        battle = battleList[index];
        
        API = wrapper(battle);
        loadCode(true);
        PAUSE = true;
    });
});

remote.getCurrentWindow().addListener('hide', () => {
    PAUSE = true;
    SM.stopBGM();
});
