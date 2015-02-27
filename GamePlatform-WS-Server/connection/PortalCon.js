/**
 * Created by Enveesoft.
 * User: Liu Xinyi
 * Date: 14-11-6
 * Time: 下午3:38
 * Write the description in this section.
 */

module.exports = PortalCon;

var BOK = require('../../common/bok/BOK'),
    Connection = require('../../common/net/ws/Connection');

BOK.inherits(PortalCon, Connection);
/**
 * @constructor
 * @param {socket.io} socket
 * @param {PortalLobby} lobby
 * */
function PortalCon(socket, lobby) {
    Connection.call(this, socket);

    this.portalLobby_ = lobby;
}

PortalCon.Event = {
    //body: {string} name of game lobby
    START_PUB_MATCHING: 'startPubMatching',
    /**
     * body: {
     *      oppId:{string},// the opponent id
     *      gameLobbyName: {string} //name of game lobby
     *      }
     */
    START_PRIVATE_MATCHING: 'startPrivateMatching',
    //body: {string} room ID
    CONFIRM_MATCH: 'confirmMatch',
    //body:{roomId:{string}, isAccept:{boolean}, gameLobbyName:{string}}
    ACCEPT_INVITE: 'acceptInvite',
    //body: {string} room ID
    CONFIRM_PRIVATE_MATCH: 'confirmPrivateMatch',
    QUICK_MATCH: 'quickMatch',
    CANCEL_QUICK_MATCH: 'cancelQuickMatch'
};

/**
 * @param {string} id The room ID
 * */
PortalCon.prototype.sendMatchReady = function (id) {
    this.send_(SERVER2CLIENT.MATCH_READY, {roomId: id});
};

/**
 * @param {string} id The room ID
 * */
PortalCon.prototype.sendLaunchGame = function (id) {
    this.send_(SERVER2CLIENT.LAUNCH_GAME, {roomId: id});
};

/**
 * @param {string} inviterName
 * @param {string} roomId
 * @param {string} gameName
 * @param {string} gameId
 * */
PortalCon.prototype.sendInviteGame = function (inviterName, roomId, gameName, gameId) {
    this.send_(SERVER2CLIENT.INVITE_GAME, {inviterName: inviterName, roomId: roomId, gameName: gameName, gameId: gameId});
};
/**
 * @param {string} id The room ID
 * */
PortalCon.prototype.sendPrivateMatchReady = function (id) {
    this.send_(SERVER2CLIENT.MATCH_PRIVATE_READY, {roomId: id});
};

PortalCon.prototype.sendQuickMatchReady = function (players, roomId, game) {
    this.send_(SERVER2CLIENT.QUICK_MATCH_READY, {players: players, roomId:roomId, game: game});
};

PortalCon.prototype.sendQuickMatchInfo = function (roomId, game) {
    this.send_(SERVER2CLIENT.QUICK_MATCH_INFO, {roomId: roomId, game: game});
};

PortalCon.prototype.sendMatchCanceled = function () {
    this.send_(SERVER2CLIENT.MATCH_CANCELED);
};

PortalCon.prototype.sendWaitingPlay = function (duration) {
    this.send_(SERVER2CLIENT.WAITING_PLAY, duration);
};

///////////////////////// Client Socket Listener ////////////////////////////////////////
/**
 * data detail refer to event definition
 * */
PortalCon.prototype.onDisconnect = function () {
    console.log('User [' + this.userId_ + '] disconnect from portal game.');
    this.portalLobby_.userLeftPortal(this.userId_);
    this.socket_.leave(this.channel);
};
/**
 *
 * @param {Object} data
 * Data format:{
 *      id: {string} // user id
 *      name:{string}
 * }
 */
PortalCon.prototype.onEnterPortal = function (data) {
    console.log('User [' + data.name + '] connecting to portal game.');

    if (this.portalLobby_.isUserInPortal(data.id)) {
        console.log('User [' + data.id + '] already connected to portal game.');
    } else {
        var THIS = this;
        this.portalLobby_.gameUserDao.getUserById(data.id, function (err, userData) {
            if (err) {
                console.error(err.stack);
            } else if (userData) {
                userData.id = userData._id;
                THIS.name = userData.name;
                THIS.userId_ = userData.id;
                userData.socketID = THIS.socket_.id;
                THIS.socket_.join(THIS.socket_.id);
                THIS.portalLobby_.recordUserConnection(userData.id, THIS);
            } else {
                var errMessage = {title: 'ERROR', message: 'User [' + data.id + '] not registered, connecting to portal fail.'};
                console.error('[ERROR]: ' + errMessage.message);
                //TODO: replace this SYS_MESSAGE with a proper ERROR message.
                //THIS.send_(SERVER2CLIENT.SYS_MESSAGE, errMessage);
            }
        });
    }
};
/**
 * data: {
 *     gameLobbyName: {string}
 * }
 * */
PortalCon.prototype.onStartMatching = function (data) {
    this.dispatchEvent(PortalCon.Event.START_PUB_MATCHING, data['gameLobbyName']);
};

/**
 * data: {
 *     oppId:{string}
 *     gameLobbyName: {string}
 *     gameId:{string}
 * }
 * */
PortalCon.prototype.onStartPrivateMatching = function (data) {
    this.dispatchEvent(PortalCon.Event.START_PRIVATE_MATCHING, data);
};

/**
 * data: {
 *     roomID: {string}
 * }
 * */
PortalCon.prototype.onAcceptInvite = function (data) {
    this.dispatchEvent(PortalCon.Event.ACCEPT_INVITE, data);
};

/**
 * data: {
 *     roomID: {string}
 * }
 * */
PortalCon.prototype.onConfirmPlay = function (data) {
    this.dispatchEvent(PortalCon.Event.CONFIRM_MATCH, data['roomID']);
};

/**
 * data: {
 *     roomID: {string}
 * }
 * */
PortalCon.prototype.onConfirmPrivatePlay = function (data) {
    this.dispatchEvent(PortalCon.Event.CONFIRM_PRIVATE_MATCH, data['roomID']);
};
PortalCon.prototype.onQuickMatch = function (data) {
    this.dispatchEvent(PortalCon.Event.QUICK_MATCH, data);
};
PortalCon.prototype.onCancelQuickMatch = function (data) {
    this.dispatchEvent(PortalCon.Event.CANCEL_QUICK_MATCH, data);
};

var SERVER2CLIENT = {
    /**
     * data:
     * {
     *      roomId: {string}
     * }
     * */
    MATCH_READY: "matchready",
    /**
     * data:
     * {
     *      roomId: {string}
     * }
     * */
    LAUNCH_GAME: "launchgame",
    /**
     * data:
     * {
     *      inviterName:{string}
     *      roomId: {string}
     *      gameName:{string}
     * }
     */
    INVITE_GAME: "invitegame",
    /**
     * data:
     * {
     *      roomId: {string}
     * }
     * */
    MATCH_PRIVATE_READY: "matchprivateready",

    /**
     *
     */
    WAIT_MATCH_PLAYER: "waitmatchplayer",
    /**
     * data:
     * {
     *      players:{Array}
     *      roomId: {string}
     *      gameName:{string}
     * }
     */
    QUICK_MATCH_READY: 'quickmatchready',
    QUICK_MATCH_ACTIVE: 'quickmatchactive',
    /**
     * data:{
     *      roomId: {string}
     *      game: {string}
     * }
     */
    QUICK_MATCH_INFO: "quickmatchinfo",
    MATCH_CANCELED: "matchcanceled",
    /**
     * data:
     * {
     *      duration:{number}
     * }
     */
    WAITING_PLAY:"waitingplay"
};