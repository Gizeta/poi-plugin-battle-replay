require(`${ROOT}/views/env`);

var path          = require('path-extra');
var clipboard     = require('electron').clipboard;
var AppData       = require('poi-plugin-battle-detail/lib/appdata');
var PacketManager = require('poi-plugin-battle-detail/lib/packet-manager');

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

MAX_PACKET_NUMBER = 64;

var battle;
var battleList = [];

function wrapper(data) {
    if (!data.version) return data;
    
    var obj = {};
    obj.hq = "0";
    obj.id = 0;
    obj.time = data.time;
    obj.fleetnum = data.packet[0].api_dock_id;
    obj.combined = data.fleet.type == 0 ? 0 : 1;
    obj.diff = 1;
    obj.world = data.map[0];
    obj.mapnum = data.map[1];
    
    obj.fleet1 = [];
    obj.fleet2 = [];
    obj.fleet3 = [];
    obj.fleet4 = [];
    var fleet = obj[`fleet${obj.fleetnum}`];
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
    if (obj.combined) {
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
    
    obj.support1 = 0;
    obj.support2 = 0;
    
    obj.battles = [];
    obj.battles[0] = {
        drop: -1,
        enemyId: 0,
        hq: "0",
        id: 0,
        node: 0,
        rating: "X",
        sortie_id: 0,
        time: data.packet[0].poi_time,
        yasen: data.packet[1] || {},
        data: data.packet[0]
    };
    return obj;
}

function generateOptions() {
    var selected = -1;
    var options = [];
    var selectedId = PacketManager.getId(battle);
    for (var i = 0; i < battleList.length; i++) {
        var battle = battleList[i];
        if (selectedId == PacketManager.getId(battle)) selected = i;
        options.push(
            $(`<option key="${i}" value="${i}">${PacketManager.getTime(battle)} ${PacketManager.getDesc(battle)}</option>`)
        );
    }
    $('select').html(options);
    $("select").prop("selectedIndex", -1);
}

$ = jQuery;
$(document).ready(() => {
    $('.__').each((idx, elem) => { $(elem).html(__($(elem).html())); });
    
    var list = AppData.listPacket();
    if (list && list.length > 0) {
        var packets = [];
        for (var i = list.length - 1; i >= 0; i--) {
            fp = list[i];
            var packet = AppData.loadPacketSync(fp);
            if (packet) packets.push(packet);
            if (packets.length >= MAX_PACKET_NUMBER) break;
        }
        battleList = battleList.concat(packets).slice(0, MAX_PACKET_NUMBER);
        battle = battleList[0];
    }
    generateOptions();
    
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
        API = JSON.parse(clipboard.readText());
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