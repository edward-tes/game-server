/**
 * Created by Enveesoft.
 * User: Liu Xinyi
 * Date: 14-11-6
 * Time: 下午3:36
 * Write the description in this section.
 */
module.exports = PortalLobby;

var BOK = require('../../common/bok/BOK'),
    PortalCon = require('../connection/PortalCon'),
    BaseLobby = require('../../common/net/ws/BaseLobby');

BOK.inherits(PortalLobby, BaseLobby);
/**
 *
 * @param {Object} daoListObj
 * @constructor
 */
function PortalLobby(daoListObj) {
    BaseLobby.call(this);

    this.gameUserDao = daoListObj.gameUserDao;
    this.gameDao = daoListObj.gameDao;
    this.userConnections_ = {};
    this.gameLobbies_ = {};
    this.openGameForPlayerConnections_ = {};
    this.privateGameForPlayerConnections_ = {};
    this.GAMES = ['quizup', 'waffle'];
    this.WAITING_PLAY_DURATION = 5000;
    this.quickMatchUserList_ = [];// data format :{player:{Connection}, game:{null|string}}, }
    this.waitingPlayTimer = null;
}

/**
 * @override
 * @param {socket.io} socket
 * @return {Connection}
 * */
PortalLobby.prototype.createConnectionInstance_ = function (socket) {
    var con = new PortalCon(socket, this);
    con.addEventListener(PortalCon.Event.START_PUB_MATCHING, BOK.createDelegate(this, this.onPlayerPubMatching_));
    con.addEventListener(PortalCon.Event.START_PRIVATE_MATCHING, BOK.createDelegate(this, this.onPlayerPrivateMatching_));
    con.addEventListener(PortalCon.Event.ACCEPT_INVITE, BOK.createDelegate(this, this.onPlayerAcceptInvite_));
    con.addEventListener(PortalCon.Event.CONFIRM_MATCH, BOK.createDelegate(this, this.onPlayerConfirmMatch_));
    con.addEventListener(PortalCon.Event.CONFIRM_PRIVATE_MATCH, BOK.createDelegate(this, this.onPlayerConfirmPrivateMatch_));
    con.addEventListener(PortalCon.Event.QUICK_MATCH, BOK.createDelegate(this, this.onPlayerQuickMatch_));
    con.addEventListener(PortalCon.Event.CANCEL_QUICK_MATCH, BOK.createDelegate(this, this.onPlayerCancelQuickMatch_));

    return con;
};


/**
 * @param {GameLobby|BaseLobby} gameLobby
 * */
PortalLobby.prototype.addGameLobby = function (gameLobby) {
    this.gameLobbies_[gameLobby.name] = gameLobby;
};

/**
 * Event listener
 * body: {string}   game lobby name
 * */
PortalLobby.prototype.onPlayerPubMatching_ = function (e) {
    var con = e.target;
    var lobby = this.gameLobbies_[e.body];
    var gameId = lobby.MatchingFromLobby();
    var gameWaitingQueue = this.openGameForPlayerConnections_[gameId] || (this.openGameForPlayerConnections_[gameId] = []);
    gameWaitingQueue.push(con);
    //check if game moved from waiting state to pending state
    if (lobby.isGamePending(gameId)) {
        gameWaitingQueue.readyPlayerNumber = 0;
        BOK.each(gameWaitingQueue, function (con) {
            con.sendPrivateMatchReady(gameId);
        });
    }
};

/**
 * Event listener
 * body: {Object}   data format:{gameLobbyName:{string}, oppId:{string}}
 * */
PortalLobby.prototype.onPlayerPrivateMatching_ = function (e) {
    var con = e.target;
    var lobby = this.gameLobbies_[e.body.gameLobbyName];
    var roomId = lobby.MatchingFromPrivate();
    var gameWaitingQueue = this.privateGameForPlayerConnections_[roomId] || (this.privateGameForPlayerConnections_[roomId] = []);
    gameWaitingQueue.push(con);
    //send invite message to opponent
    var oppCon = this.retrieveUserConnection(e.body.oppId);
    if (oppCon) {
        var data = {inviterName: con.name, roomId: roomId, gameName: e.body.gameLobbyName, gameId: e.body.gameId };
        oppCon.sendInviteGame(con.name, roomId, e.body.gameLobbyName, e.body.gameId);
    }
};

PortalLobby.prototype.onPlayerAcceptInvite_ = function (e) {
    var con = e.target;
    var roomId = e.body.roomId;
    var isAccept = e.body.isAccept;
    var lobby = this.gameLobbies_[e.body.gameLobbyName];
    var gameWaitingQueue = this.privateGameForPlayerConnections_[roomId];
    if (isAccept) {
        gameWaitingQueue.push(con);
        //check if game moved from waiting state to pending state
        var game = lobby.pendingGames_[roomId];
        game.addOnePendingPlayer();
        if (lobby.isGamePending(roomId)) {
            gameWaitingQueue.readyPlayerNumber = 0;
            BOK.each(gameWaitingQueue, function (con) {
                con.sendPrivateMatchReady(roomId);
            });
        }
    }
};
/**
 * Event listener
 * body: {string} room ID
 * */
PortalLobby.prototype.onPlayerConfirmPrivateMatch_ = function (e) {
    var gameId = e.body;
    var gameWaitingQueue = this.privateGameForPlayerConnections_[gameId];
    gameWaitingQueue.readyPlayerNumber++;

    if (gameWaitingQueue.readyPlayerNumber == gameWaitingQueue.length) {
        BOK.each(gameWaitingQueue, function (con) {
            con.sendLaunchGame(gameId);
        });

        delete this.privateGameForPlayerConnections_[gameId];
    }
};
/**
 * Event listener
 * body: {string} room ID
 * */
PortalLobby.prototype.onPlayerConfirmMatch_ = function (e) {
    var gameId = e.body;
    var gameWaitingQueue = this.openGameForPlayerConnections_[gameId];
    gameWaitingQueue.readyPlayerNumber++;

    if (gameWaitingQueue.readyPlayerNumber == gameWaitingQueue.length) {
        BOK.each(gameWaitingQueue, function (con) {
            con.sendLaunchGame(gameId);
        });

        delete this.openGameForPlayerConnections_[gameId];
    }
};
/**
 *  Quick Match event listener
 * @param e //body data format: {game:{string},}
 * @private
 */
PortalLobby.prototype.onPlayerQuickMatch_ = function (e) {

    var data = e.body;
    var player = e.target;
    var game = data.game;

    var lobby = this.gameLobbies_[game];
    var roomId = this.quickMatchUserList_.length == 0 ? lobby.MatchingFromPrivate() : null;
    this.quickMatchUserList_.push({player: e.target, room: roomId, game: game});

    //TODO: match two waiting player in a two player game. (Maybe the game need three players,now this is unused)
    if (this.quickMatchUserList_.length == 2) {
        var targetRoom = "";
        var targetGame = "";
        var players = [];
        BOK.each(this.quickMatchUserList_, function (matchInfo) {
            if (matchInfo.room) {
                targetRoom = matchInfo.room;
                targetGame = matchInfo.game;
            }
            players.push(matchInfo.player.name);
        }, this);
        BOK.each(this.quickMatchUserList_, function (matchInfo) {
            //TODO: do match ready
            matchInfo.player.sendQuickMatchReady(players, targetRoom, targetGame);
            this.quickMatchUserList_ = [];
        }, this)
    } else {
        //TODO:send match info
        player.sendQuickMatchInfo(roomId, game);
    }
};

PortalLobby.prototype.getGames = function () {

};

PortalLobby.prototype.onPlayerCancelQuickMatch_ = function (e) {
    //TODO: player cancel quick match ,so remove it from quickMatchUserList
    var player = e.target;
    var data = e.body;
    // remove quickMatchUser list
    BOK.each(this.quickMatchUserList_, function (matchInfo, index) {
        if (matchInfo.player == player) {
            this.quickMatchUserList_.splice(index, 1);
        }
        matchInfo.player.sendMatchCanceled();
    }, this);
};

PortalLobby.prototype.startQuickGame = function () {

};

PortalLobby.prototype.recordUserConnection = function (id, userSocket) {
    console.log('[PORTAL]: User *' + id + '* (id:' + id + ', socket ID:' + userSocket.id + ') connected to game portal.');
    this.userConnections_[id] = userSocket;
};

PortalLobby.prototype.retrieveUserConnection = function (id) {
    return this.userConnections_[id];
};
/**
 * @param  {string} id // user id
 * @return {Object}  Data format:
 *  {
 *      socketID: {string}
 *  }
 * */
PortalLobby.prototype.isUserInPortal = function (id) {
    return this.userConnections_[id];
};
/**
 *
 * @param {string} id
 */
PortalLobby.prototype.userLeftPortal = function (id) {
    var userDetail = this.userConnections_[id];
    if (userDetail) {
        console.log('[PORTAL]: User *' + userDetail.name + '* left message.');
        delete this.userConnections_[id];
        //TODO:delete user from match userlist
        BOK.findAndRemove(this.quickMatchUserList_, userDetail);
    }

};
