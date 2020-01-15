var mongoose = require('mongoose');

var GameSchema = new mongoose.Schema({
    gameId: {
        type: String,
        required: true
    },
    firstPlayer: {
        type: String,
        required: true
    },
    secondPlayer: {
        type: String,
        required: true
    },
    firstPlayerShipsBoard: {
        type: String,
        required: true
    },
    firstPlayerMissilesBoard: {
        type: String,
        required: true
    },
    firstPlayerOutcomesBoard: {
        type: String,
        required: true
    },
    firstPlayerEnemyMissilesBoard: {
        type: String,
        required: true
    },
    firstPlayerSunkedShips: {
        type: String,
        required: true
    },
    firstPlayerMySunkShips: {
        type: String,
        required: true
    },
    firstPlayerCurrentGameState: {
        type: String,
        required: true
    },
    firstPlayerEnemyPlacedShips: {
        type: String,
        required: true
    },
    firstPlayerMyTurn: {
        type: String,
        required: true
    },
    firstPlayerScore: {
        type: String,
        required: true
    },
    firstPlayerShipsOrientation: {
        type: String,
        required: true
    },
    secondPlayerShipsBoard: {
        type: String,
        required: true
    },
    secondPlayerMissilesBoard: {
        type: String,
        required: true
    },
    secondPlayerOutcomesBoard: {
        type: String,
        required: true
    },
    secondPlayerEnemyMissilesBoard: {
        type: String,
        required: true
    },
    secondPlayerSunkedShips: {
        type: String,
        required: true
    },
    secondPlayerMySunkShips: {
        type: String,
        required: true
    },
    secondPlayerCurrentGameState: {
        type: String,
        required: true
    },
    secondPlayerEnemyPlacedShips: {
        type: String,
        required: true
    },
    secondPlayerMyTurn: {
        type: String,
        required: true
    },
    secondPlayerScore: {
        type: String,
        required: true
    },
    secondPlayerShipsOrientation: {
        type: String,
        required: true
    }
});

var Game = mongoose.model('Game',GameSchema);

module.exports = Game;