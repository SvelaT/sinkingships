var mongoose = require('mongoose');

var ScoreSchema = new mongoose.Schema({
    gameId: {
        type: String,
        required: true
    },
    firstPlayer: {
        type: String,
        required: true
    },
    firstPlayerScore: {
        type: String,
        required: true
    },
    secondPlayer: {
        type: String,
        required: true
    },
    secondPlayerScore: {
        type: String,
        required: true
    },
});

var Score = mongoose.model('Score',ScoreSchema);

module.exports = Score;