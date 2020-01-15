//imports 
var ejs = require('ejs');
var express = require('express');
var app = express();
var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');
var socketio = require('socket.io');
var expressLayouts = require('express-ejs-layouts');
var passport = require('passport');
app.use(expressLayouts);
var flash = require('connect-flash');
var session = require('express-session');

require('./config/passport')(passport);

//server configuration
var http = require('http');
var server = http.createServer(app);

//socket io and players array
var io = socketio.listen(server);
var players = [];

//playing waiting for someone to join
var waitingPlayers = new Map();

//player that are currently playing the game
var playingPlayers = [];

//associative array, key is the socketid and Value is the corresponding player
//used by the game
var playerSocket = [];

//associative array, key is the player and Value is the corresponding socketid
//used by the game
var socketPlayer = [];

//associative array, key is the player and Value is the corresponding socketid
//used by the lobby
var lobbyPlayers = [];

//associative array, key is the socket and Value is the corresponding player
//used by the lobby
var lobbySockets = [];

//associative array, key is the game id on the database and Value is the player that requested the load
var loadGame = [];

//array, key is the game id and the value contains a string with the players' names
var games = [];

//used to update game id's
var lastGameId = 0;

//array, key is the game id and the value is the player that requested the save game
var saveGame = [];

//array, key is the game id and the value is used to save the players score before updating the database
var saveScore = [];

//associative array, key is the player that was requested to play, while value is the player that made the request 
var playWithPlayer = [];

//associative array, key is the player email and value is the player role
var userRole = [];

//socket configuration
var socketio = require('socket.io');
var io = socketio(server);

//views configuration
app.set('view engine','ejs');
app.set('views',__dirname+'/views');

//Database configuration
var db = require('./config/keys').MongoURI;
mongoose.connect(db, { useUnifiedTopology: true, useNewUrlParser: true}).then(function (){
    console.log("Connected to MongoDB");
}).catch(function(err){
    console.log(err);
});

app.use(express.urlencoded({ extended: false}));

app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}));

//Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

//Flash Middleware
app.use(flash());

//Middleware for Flash
app.use(function(req, res, next){
    res.locals.ok_message = req.flash('ok_message');
    res.locals.error = req.flash('error');
    next();
});

//Middleware to save some session values for view
app.use(function (req, res, next) {
    res.locals.login = req.isAuthenticated();
    if(req.isAuthenticated()){
        res.locals.currentUser = req.user.username;
        res.locals.currentUserEmail = req.user.email;
        res.locals.currentUserRole = userRole[req.user.email];
    }
    next();
});

//Allow easy access to the public folder
app.use(express.static('public'))

//User model
var User = require('./models/User');

//Game model
var Game = require('./models/Game');

//Score model
var Score = require('./models/Score');

//get request to the root 
app.get('/',function(req,res){
    res.render('index');
});

//get request to login
app.get('/login',function(req,res){
    res.render('login');
});

//post request to login
app.post('/login',function(req,res, next){
    //authenticate
    passport.authenticate('local', {
        successRedirect: '/',
        failureRedirect: '/login',
        failureFlash: true
    })(req,res,next);
    //get the user role and save it to the locals
    User.findOne({email: req.body.email},function(err,user){
        if(user){
            userRole[req.body.email] = user.role;
        }
    });
});

//get request to logout
app.get('/logout',function(req,res){
    req.logOut();
    req.flash('You are logged out');
    res.redirect('/login');
});

//get request to register
app.get('/register',function(req,res){
    res.render('register');
});

//get request to highscores
app.get('/highscores',function(req,res){
    Score.find({},function(err,scores){
        var ordered = orderScores(scores);
        res.render('highscores',{
            scoresList: ordered
        });
    });
});

//returns a scores array ordered by highest scores(player1 or player2), limits this to 20 scores 
function orderScores(scores){
    var original = scores;
    var newArray = [];

    for(var i = 0; i < 20; i++){
        if(original.length <= 0){
            break;
        }
        var biggestIndex = 0;
        var maxValue = 0;

        for(var j = 0; j < original.length; j++){
            if(maxValue <= original[j].firstPlayerScore){
                biggestIndex = j;
                maxValue = original[j].firstPlayerScore;
            }
            if(maxValue <= original[j].secondPlayerScore){
                biggestIndex = j;
                maxValue = original[j].secondPlayerScore;
            }
        }
        newArray.push(original[biggestIndex]);
        original.splice(biggestIndex,1);
    }
    return newArray;
}

//get request to leaderboard
app.get('/leaderboard',function(req,res){
    User.find({},function(err,users){
        var ordered = orderLeaders(users);
        res.render('leaderboard',{
            leadersList: ordered
        });
    });
});

//returns a users array ordered by highest number of victories, limits this to 20 users
function orderLeaders(leaders){
    var original = leaders;
    var newArray = [];

    for(var i = 0; i < 20; i++){
        if(original.length <= 0){
            break;
        }
        var biggestIndex = 0;
        var maxValue = 0;

        for(var j = 0; j < original.length; j++){
            if(maxValue <= original[j].victories){
                biggestIndex = j;
                maxValue = original[j].victories;
            }
        }
        newArray.push(original[biggestIndex]);
        original.splice(biggestIndex,1);
    }
    for(var user in newArray){
        user.password = "";    
    }
    return newArray;
}

//get request to admin
//if the user isn't authenticated, they should be redirected to the login page
//admin commands only appear if the user has the admin role
app.get('/admin',function(req,res){
    if(req.isAuthenticated()){
        if(userRole[req.user.email] == "admin"){
            res.render('admin',{
                allowed: true
            });
        }
        else{
            res.render('admin',{
                allowed: false
            });
        }
    }
    else{
        res.redirect('/login');
    }
});

//get request to clean/object
//it deletes all the highscores or saved games from the database
//it only removes them if the user has the admin role
app.get('/clean/:object',function(req,res){
    if(req.isAuthenticated()){
        if(userRole[req.user.email] == "admin"){
            switch(req.params.object){
                case "highscores":
                    Score.deleteMany({},function(err){
                        if(err){
                            req.flash('error',"Something went wrong");
                        }
                        else{
                            req.flash('ok_message',"All the scores were removed");
                        }
                        res.redirect('/admin');
                    });
                    break;
                case "games":
                    Game.deleteMany({},function(err){
                        if(err){
                            req.flash('error',"Something went wrong");
                        }
                        else{
                            req.flash('ok_message',"All the saved games were removed");
                        }
                        res.redirect('/admin');
                    });
                    break;
                default:
                    req.flash('error',"Invalid operation");
                    res.redirect('/admin');
                    break;
            }
        }
    }
    else{
        res.redirect('/login');
    }
});

//get request to profile
//it sends the victories, defeats and saved games to the profile view
app.get('/profile',function(req,res){
    if(!req.isAuthenticated()){
        res.redirect('/login');
        return;
    }

    var player = req.user.username+"("+req.user.email+")";

    Game.find({$or:[
        {firstPlayer: player},
        {secondPlayer: player}
    ]},function(err,games){
        User.findOne({email: req.user.email},function(err,user){
            res.render('profile',{
                gamesList: games,
                victories: parseInt(user.victories),
                defeats: parseInt(user.defeats)
            });
        });
    });
});

//post request to changepassword
//password is encrypted
app.post('/changepassword',function(req,res){
    var password = req.body.password;
    var confirmPassword =  req.body.confirmPassword;

    if(password == confirmPassword){
        bcrypt.genSalt(10, function(err,salt){
            bcrypt.hash(password, salt, function(err, hash){
                if(err) throw err;
                password = hash;
                User.findOne({ email : req.user.email},function(err,doc){
                    if(err) throw err;

                    doc.password = password;
                    doc.save().then(function(user){
                        req.flash('ok_message',"Password Changed!");
                        res.redirect('/profile');
                    }).catch(function(err){
                        req.flash('error',"Something Wrong Happened, Please try later.");
                        res.redirect('/profile');
                        console.log(err);
                    });
                });
            });
        });
    }
    else{
        req.flash('error',"Passwords don't match!");
        res.redirect('/profile');
    }
});

//get request to game
//this is the standard waiting queue game
app.get('/game',function(req,res){
    if(!req.isAuthenticated()){
        res.redirect('/login');
        return;
    }
    res.render('game');
});

//get request to game/id (game id on database)
//this page is called when the user wants to load a game
app.get('/game/:id',function(req,res){
    if(!req.isAuthenticated()){
        res.redirect('/login');
        return;
    }

    var id = req.params.id;
    var player = req.user.username+"("+req.user.email+")";
    var wait;
    var thisGameId;
    var removeGame = false;
    //loadGame will be empty if noone requested that game loading
    if(loadGame[id] && loadGame[id] != player){
        //if someone already requested this game load
        //set a new game id, push the player to the array, and warn the other player that the game was loaded
        lastGameId++;
        thisGameId = lastGameId;
        games[lastGameId] = player+"#"+loadGame[id];
        io.emit('accepted load', loadGame[id]+"#"+player+"#"+lastGameId);
        //this player doesn't need to wait
        wait = "true";
        playingPlayers.push(loadGame[id]);
        playingPlayers.push(player);
        removeGame = true;
    }
    else{
        //if noone request the load
        //save the request to the loadGame array
        loadGame[id] = player;
        //this player needs to wait for the load acceptance
        wait = "false";
        thisGameId = -1;
    }
    //get the game data from the database
    Game.findOne({_id: id},function(err,game){
        if(game.firstPlayer == player){
            //renders view with the first player data
            res.render('game',
            {
                currentGameId: thisGameId,
                shipsBoard: game.firstPlayerShipsBoard,
                missilesBoard: game.firstPlayerMissilesBoard,
                outcomesBoard: game.firstPlayerOutcomesBoard,
                enemyMissilesBoard: game.firstPlayerEnemyMissilesBoard,
                sunkedShips: game.firstPlayerSunkedShips,
                mySunkShips: game.firstPlayerMySunkShips,
                currentGameState: game.firstPlayerCurrentGameState,
                enemyPlacedShips: game.firstPlayerEnemyPlacedShips,
                myTurn: game.firstPlayerMyTurn,
                shipsOrientation: game.firstPlayerShipsOrientation,
                score: game.firstPlayerScore,
                enemyPlayer: game.secondPlayer,
                wait: wait
            });
        }
        else if(game.secondPlayer == player){
            //renders view with the second player data
            res.render('game',
            {
                currentGameId: thisGameId,
                shipsBoard: game.secondPlayerShipsBoard,
                missilesBoard: game.secondPlayerMissilesBoard,
                outcomesBoard: game.secondPlayerOutcomesBoard,
                enemyMissilesBoard: game.secondPlayerEnemyMissilesBoard,
                sunkedShips: game.secondPlayerSunkedShips,
                mySunkShips: game.secondPlayerMySunkShips,
                currentGameState: game.secondPlayerCurrentGameState,
                enemyPlacedShips: game.secondPlayerEnemyPlacedShips,
                myTurn: game.secondPlayerMyTurn,
                shipsOrientation: game.secondPlayerShipsOrientation,
                score: game.secondPlayerScore,
                enemyPlayer: game.firstPlayer,
                wait: wait
            });
        }
        //remove the game from the database and the request from the loadGame array
        if(removeGame){
            delete loadGame[id];
            Game.deleteOne({_id: id},function(err){
                if(err){
                    throw err;
                }
                else{
                    console.log("game removed from database");
                }
            });
        }
    });
});

//get request to game/player/player 
//this page is called when the user wants to play with a player in specific
app.get('/game/player/:player',function(req,res){
    if(!req.isAuthenticated()){
        res.redirect('/login');
        return;
    }

    var enemy = req.params.player;
    var player = req.user.username+"("+req.user.email+")";
    var thisGameId = -1;

    if(!playWithPlayer[player]){
        //if it is the player that requested the join
        //needs to wait
        wait="false";
        playWithPlayer[enemy] = player;
        io.to(lobbyPlayers[enemy]).emit('join request',player);
    }
    else{
        //if it is the player the other player
        //doesn't need to wait
        wait="true";
        //configure new game id and push the players to arrays
        lastGameId++;
        thisGameId = lastGameId;
        games[lastGameId] = player+"#"+enemy;
        //warn the other player
        io.emit('accepted join player', enemy+"#"+player+"#"+lastGameId);
        playingPlayers.push(enemy);
        playingPlayers.push(player);
    }
    res.render('game',{
        joinWithPlayer: thisGameId,
        wait: wait,
        enemyPlayer: enemy
    });
});

//get request to lobby
app.get('/lobby',function(req,res){
    if(req.isAuthenticated()){
        res.render('lobby');
    }
    else{
        res.redirect('/login');
    }
});

//post request to register
app.post('/register',function(req,res){
    //request data
    var username = req.body.username;
    var password = req.body.password;
    var email = req.body.email;
    var confirmPassword =  req.body.confirmPassword;
    var role = "user";
    var victories = "0";
    var defeats = "0";

    var errors = [];

    //server side validation
    if(!username){
        errors.push({ msg : 'Please provide a username'})
    }
    if(!password){
        errors.push({ msg : 'Please provide a password'})
    }
    if(!email){
        errors.push({ msg : 'Please provide an email'})
    }
    if(password != confirmPassword){
        errors.push({ msg : 'Passwords do not match'})
    }

    //if we have errors
    if(errors.length > 0){
        res.render('register', {
            errors,
            username,
            email,
            password,
            confirmPassword
        });
    }

    //check if there's a user with the same email
    User.findOne({ email : email}).then(function(user){
        //if there is
        if(user){
            errors.push({ msg : 'Email already registered'})
            res.render('register', {
                errors,
                username,
                email,
                password,
                confirmPassword
            });
        }
        else{
            //in case the email is not registered
            var newUser = new User({
                username,
                email,
                password,
                role,
                victories,
                defeats
            });

            //encrypt the password
            bcrypt.genSalt(10, function(err,salt){
                bcrypt.hash(newUser.password, salt, function(err, hash){
                    if(err) throw err;
                    newUser.password = hash;
                    newUser.save().then(function(user){
                        req.flash('ok_message','Successful registration! Now you can login');
                        res.redirect('/login');
                    }).catch(function(err){
                        console.log(err);
                    });
                });
            });
        }
    });
});

//socket messages configuration
//messages with multiple data are organized using the # character
io.sockets.on('connection', function(socket){
    console.log('Someone joined the server');

    //Join lobby message, received when user joins the lobby
    socket.on('join lobby',function(name){
        io.emit('update',"Server: "+name+" joined the lobby!");
        //update server local variables
        lobbyPlayers[name] = socket.id;
        lobbySockets[socket.id] = name;
        var message = "";
        for(var player in lobbyPlayers){
            if(message != ""){
                message += "#";
            }
            message += player;
        }
        //send lobby players list to the new joiner
        socket.emit('lobby players',message);
        //send the new joiner to everyone else
        io.emit('add player',name);
    });

    //Lobby message message, received when posts a message in the lobby chat
    socket.on('lobby message',function(msg){
        //send the message to everyone else
        io.emit('update',msg);
    });

    //Join game message, received when a player wants to join the game queue
    socket.on('join game',function(name){
        //update player socket
        socketPlayer[name] = socket.id;
        //check if the player is already playing another game
        if(playingPlayers.includes(name)){
            socket.emit('not allowed to join','');
        }
        else{
            playerSocket[socket.id] = name;
            //if the queue is empty
            if(waitingPlayers.size == 0){
                //push the player to the queue
                waitingPlayers.set(socket.id,name);
            }
            else{
                //if not, remove the other player from the queue and warn him of the game acceptance
                var enemy = waitingPlayers.values().next().value;
                var socketId = waitingPlayers.keys().next().value;
                //check if it is the same player
                if(enemy != name){
                    waitingPlayers.delete(socketId);
                    lastGameId++;
                    var game = lastGameId;
                    games[lastGameId] = name+"#"+enemy;
                    io.to(socketPlayer[name]).emit('accepted game', enemy+"#"+game+"#first");
                    playingPlayers.push(name);
                    io.to(socketPlayer[enemy]).emit('accepted game', name+"#"+game+"#empty");
                    playingPlayers.push(enemy);
                    console.log("Game Created : "+games[lastGameId]);
                }
            }
        }
    });

    //Join request denied message, received when a player denies a playing request from another player
    //should warn the other player
    socket.on('join request denied',function(player){
        for(var index in playWithPlayer){
            if(index == player){
                io.to(socketPlayer[playWithPlayer[index]]).emit('join request denied',player);
                break;
            }
        }
    });

    //Forfeited message, received when a player forfeits the game
    //should warn the other player
    socket.on('forfeited', function(message){
        var gameId = parseInt(message.split('#')[0]);
        var player = message.split('#')[1];
        var players = games[gameId];
        var player1 = players.split('#')[0];
        var player2 = players.split('#')[1];

        if(player == player1){
            io.to(socketPlayer[player2]).emit('player forfeited', '');
        }
        else{
            io.to(socketPlayer[player1]).emit('player forfeited', '');
        }
    });

    //Placed ships message, received when a player finishes placing his ships
    //should warn the other player
    socket.on('placed ships', function(message){
        var gameId = parseInt(message.split('#')[0]);
        var player = message.split('#')[1];
        var players = games[gameId];
        var player1 = players.split('#')[0];
        var player2 = players.split('#')[1];

        if(player == player1){
            io.to(socketPlayer[player2]).emit('placed ships', '');
        }
        else{
            io.to(socketPlayer[player1]).emit('placed ships', '');
        }
    });

    //Placed missile message, received when a player places a missile on the enemy board
    //should warn the other player with the position
    socket.on('placed missile',function(message){
        var gameId = parseInt(message.split('#')[0]);
        var player = message.split('#')[1];
        var players = games[gameId];
        var player1 = players.split('#')[0];
        var player2 = players.split('#')[1];
        var x = message.split('#')[2];
        var y = message.split('#')[3];

        if(player == player1){
            io.to(socketPlayer[player2]).emit('placed missile', x+"#"+y);
        }
        else{
            io.to(socketPlayer[player1]).emit('placed missile', x+"#"+y);
        }
    });

    //Missile outcome message, received when a player sends the missile placement outcome
    //The game runs on the client side, so the server doesn't know the positioning of ships
    //should warn the other player with the outcome of the missile placement and position
    socket.on('missile outcome',function(message){
        var gameId = parseInt(message.split('#')[0]);
        var player = message.split('#')[1];
        var players = games[gameId];
        var player1 = players.split('#')[0];
        var player2 = players.split('#')[1];
        var x = message.split('#')[2];
        var y = message.split('#')[3];
        var ship = message.split('#')[4];
        
        if(player == player1){
            io.to(socketPlayer[player2]).emit('missile outcome', x+"#"+y+"#"+ship);
        }
        else{
            io.to(socketPlayer[player1]).emit('missile outcome', x+"#"+y+"#"+ship);
        }
    });

    //Save game message, received when a player wants to save the game for later
    //should warn the other player
    socket.on('save game',function(message){
        var gameId = parseInt(message.split('#')[0]);
        var player = message.split('#')[1];
        var players = games[gameId];
        var player1 = players.split('#')[0];
        var player2 = players.split('#')[1];

        if(player == player1){
            io.to(socketPlayer[player2]).emit('save game', '');
        }
        else{
            io.to(socketPlayer[player1]).emit('save game', '');
        }
    });

    //Save denied message, received when a player denies the other player's request to save the game
    //should warn the other player
    socket.on('save denied',function(message){
        var gameId = parseInt(message.split('#')[0]);
        var player = message.split('#')[1];
        var players = games[gameId];
        var player1 = players.split('#')[0];
        var player2 = players.split('#')[1];

        if(player == player1){
            io.to(socketPlayer[player2]).emit('save denied', '');
        }
        else{
            io.to(socketPlayer[player1]).emit('save denied', '');
        }
    });

    //Save accepted, received when a player accepts the other player's request to save the game
    //should warn the other player
    socket.on('save accepted',function(message){
        var gameId = parseInt(message.split('#')[0]);
        var player = message.split('#')[1];
        var players = games[gameId];
        var player1 = players.split('#')[0];
        var player2 = players.split('#')[1];

        if(player == player1){
            io.to(socketPlayer[player2]).emit('save accepted', '');
        }
        else{
            io.to(socketPlayer[player1]).emit('save accepted', '');
        }
    });

    //Save state message, received when a player sends the whole game state to the server
    //Happens after save game acceptance
    //The two player should send their state at different moments in time, so the server should keep the first player's state and wait for the second player to submit their state
    socket.on('save state',function(message){
        var gameId = parseInt(message.split('#')[0]);
        var player = message.split('#')[1];
        var players = games[gameId];
        var player1 = players.split('#')[0];
        var player2 = players.split('#')[1];
        var enemy;

        if(player == player1){
            enemy = player2;
        }
        else{
            enemy = player1;
        }

        var playerInfo = message.split('#');

        if(saveGame[gameId]){
            
            var firstPlayerShipsBoard = playerInfo[2];
            var firstPlayerMissilesBoard = playerInfo[3];
            var firstPlayerOutcomesBoard = playerInfo[4];
            var firstPlayerEnemyMissilesBoard = playerInfo[5];
            var firstPlayerSunkedShips = playerInfo[6];
            var firstPlayerMySunkShips = playerInfo[7];
            var firstPlayerCurrentGameState = playerInfo[8];
            var firstPlayerEnemyPlacedShips = playerInfo[9];
            var firstPlayerMyTurn = playerInfo[10];
            var firstPlayerScore = playerInfo[11];
            var firstPlayerShipsOrientation = playerInfo[12];

            var enemyInfo = saveGame[gameId].split("#");

            var secondPlayerShipsBoard = enemyInfo[2];
            var secondPlayerMissilesBoard = enemyInfo[3];
            var secondPlayerOutcomesBoard = enemyInfo[4];
            var secondPlayerEnemyMissilesBoard = enemyInfo[5];
            var secondPlayerSunkedShips = enemyInfo[6];
            var secondPlayerMySunkShips = enemyInfo[7];
            var secondPlayerCurrentGameState = enemyInfo[8];
            var secondPlayerEnemyPlacedShips = enemyInfo[9];
            var secondPlayerMyTurn = enemyInfo[10];
            var secondPlayerScore = enemyInfo[11];
            var secondPlayerShipsOrientation = enemyInfo[12];

            var newGame = new Game({
                gameId: gameId,
                firstPlayer: player,
                secondPlayer: enemy,
                firstPlayerShipsBoard: firstPlayerShipsBoard,
                firstPlayerMissilesBoard: firstPlayerMissilesBoard,
                firstPlayerOutcomesBoard: firstPlayerOutcomesBoard,
                firstPlayerEnemyMissilesBoard: firstPlayerEnemyMissilesBoard,
                firstPlayerSunkedShips: firstPlayerSunkedShips,
                firstPlayerMySunkShips: firstPlayerMySunkShips,
                firstPlayerCurrentGameState: firstPlayerCurrentGameState,
                firstPlayerEnemyPlacedShips: firstPlayerEnemyPlacedShips,
                firstPlayerMyTurn: firstPlayerMyTurn,
                firstPlayerScore: firstPlayerScore,
                firstPlayerShipsOrientation: firstPlayerShipsOrientation,
                secondPlayerShipsBoard: secondPlayerShipsBoard,
                secondPlayerMissilesBoard: secondPlayerMissilesBoard,
                secondPlayerOutcomesBoard: secondPlayerOutcomesBoard,
                secondPlayerEnemyMissilesBoard: secondPlayerEnemyMissilesBoard,
                secondPlayerSunkedShips: secondPlayerSunkedShips,
                secondPlayerMySunkShips: secondPlayerMySunkShips,
                secondPlayerCurrentGameState: secondPlayerCurrentGameState,
                secondPlayerEnemyPlacedShips: secondPlayerEnemyPlacedShips,
                secondPlayerMyTurn: secondPlayerMyTurn,
                secondPlayerScore: secondPlayerScore,
                secondPlayerShipsOrientation: secondPlayerShipsOrientation 
            });
            

            newGame.save().then(function(){
                console.log("Game data saved");
            }).catch(function(err){
                console.log(err);
            });
        }
        else{
            saveGame[gameId] = message;
        }
    });

    //Save score message, received when a player sends their game score to save it on the database
    //Happens at the end of games
    //The two player should send their score at different moments in time, so the server should keep the first player's score and wait for the second player to submit their score
    socket.on('save score',function(message){
        var gameId = parseInt(message.split('#')[0]);
        var player = message.split('#')[1];
        var players = games[gameId];
        var player1 = players.split('#')[0];
        var player2 = players.split('#')[1];
        var enemy;

        if(player == player1){
            enemy = player2;
        }
        else{
            enemy = player1;
        }

        var playerInfo = message.split('#');

        if(saveScore[gameId]){
            var firstPlayerScore = playerInfo[2];

            var enemyInfo = saveScore[gameId].split("#");

            var secondPlayerScore = enemyInfo[2];

            var newScore = new Score({
                gameId: gameId,
                firstPlayer: player,
                firstPlayerScore: firstPlayerScore,
                secondPlayer: enemy,
                secondPlayerScore: secondPlayerScore
            });

            newScore.save().then(function(){
                console.log("Score data saved");
            }).catch(function(err){
                console.log(err);
            });
        }
        else{
            saveScore[gameId] = message;
        }
    });

    //Update score message, received when a player sends their game score to the other player
    //Used to update the different players scores
    socket.on('update score',function(message){
        var gameId = parseInt(message.split('#')[0]);
        var player = message.split('#')[1];
        var players = games[gameId];
        var player1 = players.split('#')[0];
        var player2 = players.split('#')[1];
        var points = message.split('#')[2];

        if(player == player1){
            io.to(socketPlayer[player2]).emit('update score', points);
        }
        else{
            io.to(socketPlayer[player1]).emit('update score', points);
        }
    });

    //Update socket message, received when a player wants to update his socket id on the server
    socket.on('update socket',function(player){
        socketPlayer[player] = socket.id;
        playerSocket[socket.id] = player;
    });

    //Save defeat message, received when a player wants to save a defeated game to their statistics
    //Happens at the end of games
    socket.on('save defeat',function(email){
        User.findOne({email: email},function(err,doc){
            if(err) throw err;

            var defeats = parseInt(doc.defeats);
            defeats++;
            doc.defeats = defeats.toString();

            doc.save().then(function(user){
                console.log("Defeat saved for "+email);
            }).catch(function(err){
                console.log(err);
            });
        });
    });
        
    //Save defeat message, received when a player wants to save a victorious game to their statistics
    //Happens at the end of games
    socket.on('save victory',function(email){
        User.findOne({email: email},function(err,doc){
            if(err) throw err;

            var victories = parseInt(doc.victories);
            victories++;
            doc.victories = victories.toString();

            doc.save().then(function(user){
                console.log("Victory saved for "+email);
            }).catch(function(err){
                console.log(err);
            });
        });
    });

    //Game ended message, received when a player warns the game ending
    //Used to clean playingPlayers array
    socket.on('game ended',function(player){
        if(playingPlayers.includes(player)){
            var index = playingPlayers.indexOf(player);
            playingPlayers.splice(index,1);
        }
    });

    //Disconnect message, received when a player disconnects from the socket
    socket.on('disconnect',function(data){
        //clean the waiting players
        if(waitingPlayers.has(socket.id)){
            waitingPlayers.delete(socket.id);
        }
        //clean the playing players and warns of forfeits if a player exits the game
        if(playingPlayers.includes(playerSocket[socket.id])){
            var index = playingPlayers.indexOf(playerSocket[socket.id]);
            playingPlayers.splice(index,1);
            for(var index in games){
                var players = games[index];
                var player1 = players.split('#')[0];
                var player2 = players.split('#')[1];

                if(player1 == playerSocket[socket.id]){
                    io.to(socketPlayer[player2]).emit('player forfeited','');
                    break;
                }
                if(player2 == playerSocket[socket.id]){
                    io.to(socketPlayer[player1]).emit('player forfeited','');
                    break;
                }
            }
        }
        //clean the lobby players
        if(lobbySockets[socket.id]){
            var player = lobbySockets[socket.id];
            delete lobbyPlayers[player];
            delete lobbySockets[socket.id];
            io.emit('exit from lobby',player);
        }
        //clean the playing with other players array
        for(var index in playWithPlayer){
            if(playWithPlayer[index] == playerSocket[socket.id]){
                delete playWithPlayer[index];
            }
        }
        console.log('Someone disconnected');
    });
});

//start to listen, localhost port 8080
server.listen(8080,function(){
    console.log("Sinking Ships Server listening on port 8080");
});