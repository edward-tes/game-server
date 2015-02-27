/**
 * Created by Envee.
 *
 * Date: 15-1-29
 * Time: 下午5:08
 * @author: <a href="526597516@qq.com">luyc</a>
 * @version: 0.1
 */

var BOK = require('../bok/BOK');
var AbstractDao = require('./AbstractDao');

module.exports = GameRatingDao;

BOK.inherits(GameRatingDao, AbstractDao);

/**
 *
 * @param {monk} db   //the monk instance
 */
function GameRatingDao(db) {
    AbstractDao.call(this, db);
    this.tGameRatingData_ = db.get('tGameRating');
}

/**
 * add rating to game
 * @param {Object} ratingInfo // data format:
 * {
 *      gameId:{string}
 *      rating:{float}
 *      userId:{string||null}
 *      userName:{string}
 *      content:{string}
 * }
 * @param {Function} cb
 */
GameRatingDao.prototype.addRating = function (ratingInfo, cb) {
    this.tGameRatingData_.insert(ratingInfo, function (error, doc) {
        if (error) {
            cb(error)
        } else {
            cb(null, doc)
        }
    });
};

GameRatingDao.prototype.getRatingByGameId = function (gameId, cb) {
    this.tGameRatingData_.col.find({gameId: gameId}).toArray(function (error, docs) {
        if (error) {
            cb(error)
        } else {
            cb(null, docs)
        }
    });
};
GameRatingDao.prototype.getRatingByUserIdAndGameId = function (gameId, userId, cb) {
    this.tGameRatingData_.findOne({gameId: gameId, userId: userId}, function (error, doc) {
        if (error) {
            cb(error)
        } else {
            cb(null, doc)
        }
    });
};