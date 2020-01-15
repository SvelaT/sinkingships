//socket 
var socket;
//variable for vue
var app;

//game sounds 
var waterSound;
var placeShipSound;
var explosionSound;
var bigExplosionSound;

//player credentials
var username;
var email;

//the game id, is set when the player loads a game
var loadGameId;

//the game id, is set when the player wants to play with another play
var joinPlayerId;

//this is a variable containing data in the following format username(email), used to identify the player in the socket messages
var fullid;

//current game Id
var gameId;

//grid dimensions
var gridX;
var gridY;

//current game state
var currentGameState;

//matrix containing the ship placement information
var shipsBoard;

//matrix containing the missile placement information
var missilesBoard;

//matrix containing the missile placement outcome information
var outcomesBoard;

//matrix containing the enemy missile placement information
var enemyMissilesBoard;

//map containing the ships' names
var shipsIndexes = new Map([
    [0,'Carrier'],
    [1,'Battleship'],
    [2,'Cruiser'],
    [3,'Submarine'],
    [4,'Destroyer']
]);

//map containing the ships' sizes
var ships = new Map([
    ['Carrier',5],
    ['Battleship',4],
    ['Cruiser',3],
    ['Submarine',3],
    ['Destroyer',2]
]);

//map containing the ships' current orientation 
var shipsOrientation = new Map([
    ['Carrier','default'],
    ['Battleship','default'],
    ['Cruiser','default'],
    ['Submarine','default'],
    ['Destroyer','default']
]);

//array containing the enemy's sunked ships
var sunkedShips = [];

//array containing the player's sunked ships
var mySunkShips = [];

//id of the current ship being placed
var currentShip;
//current ship placement orientation
var currentShipOrientation;
//html element id of the current hovered tile
var currentTileId;
//html element id of the current hovered enemy tile
var currentTileIdEnemy;
//boolean containing true if the enemy has already placed their ships
var enemyPlacedShips;
//boolean containing true if it is the current player's turn
var myTurn;

//current point streak
var streak;

//when the page is ready
$(document).ready(function(){
    //get data from the html document
    username = $('#current-user').text();
    email = $('#current-user-email').text();
    if($('#current-game-id').length > 0){
        loadGameId = $('#current-game-id').text();
    }
    else{
        loadGameId = "empty";
    }

    if($('#join-with-player').length > 0){
        joinPlayerId = $('#join-with-player').text();
    }
    else{
        joinPlayerId = "empty";
    }
    fullid = username+"("+email+")";

    //get the sounds from the html document
    waterSound = document.getElementById("water");
    placeShipSound = document.getElementById("placeship");
    explosionSound = document.getElementById("explosion");
    bigExplosionSound = document.getElementById("bigexplosion");

    //set the game variable to their initial values
    currentGameState="Placing Ships";
    currentShip = 0;
    currentShipOrientation = 1;

    gridX = 10;
    gridY = 9;

    enemyPlacedShips = false;

    streak = 1.0;
    
    //set all the matrixes' elements to empty
    shipsBoard = new Array(gridX);
    for(var i = 0; i < shipsBoard.length; i++){
        shipsBoard[i] = new Array(gridY);
        for(var j = 0; j < shipsBoard[i].length; j++){
            shipsBoard[i][j] = 'empty';
        }
    }

    missilesBoard = new Array(gridX);
    for(var i = 0; i < missilesBoard.length; i++){
        missilesBoard[i] = new Array(gridY);
        for(var j = 0; j < missilesBoard[i].length; j++){
            missilesBoard[i][j] = 'empty';
        }
    }

    outcomesBoard = new Array(gridX);
    for(var i = 0; i < outcomesBoard.length; i++){
        outcomesBoard[i] = new Array(gridY);
        for(var j = 0; j < outcomesBoard[i].length; j++){
            outcomesBoard[i][j] = 'empty';
        }
    }

    enemyMissilesBoard = new Array(gridX);
    for(var i = 0; i < enemyMissilesBoard.length; i++){
        enemyMissilesBoard[i] = new Array(gridY);
        for(var j = 0; j < enemyMissilesBoard[i].length; j++){
            enemyMissilesBoard[i][j] = 'empty';
        }
    }

    //set vue
    app = new Vue({
        el: '#app',
        data:{
            state: "Placing Ships",
            turn: "",
            points: 0,
            pointsEnemy: 0
        },
        methods:{

        }
    });

    //configure the socket messages' callbacks
    socket = new io();
    socket.on('accepted game',handleAcceptedGame);
    socket.on('player forfeited',handlePlayerForfeit);
    socket.on('placed ships',handleEnemyPlacedShips);
    socket.on('placed missile',handlePlacedMissile);
    socket.on('missile outcome',handleMissileOutcome);
    socket.on('save game',handleSaveGame);
    socket.on('save denied',handleSaveDenied);
    socket.on('save accepted',handleSaveAccepted);
    socket.on('update score',handleUpdateScore);
    socket.on('accepted load',handleAcceptedLoad);
    socket.on('not allowed to join',handleNotAllowedToJoin);
    socket.on('accepted join player',handleAcceptedJoinPlayer);
    socket.on('join request denied',handleJoinRequestDenied);

    //when the player presses the forfeit button
    $('#forfeit').on('click',function(){
        //wait for confirmation
        var forfeited = confirm("Are you sure you want to forfeit the game?");
        if(forfeited){
            //change the game state and warn the server about the forfeit
            socket.emit('forfeited',gameId+"#"+fullid);
            saveGameScore();
            currentGameState = "Finished";
            app.$data.state = "Finished";
            app.$data.turn = "You forfeited the game. You lost...";
            socket.emit('game ended',fullid);
            socket.emit('save defeat',email);
            $(this).css('display','none');
            $('#save').css('display','none');
        }
    });

    //when the player presses the save button
    $('#save').on('click',function(){
        var accept = confirm("Are you sure you want to save the game for later?");
        if(accept){
            alert("Your oponent will be notified, if he accepts it, this game will be saved for later");
            socket.emit('save game',gameId+"#"+fullid);
            $(this).css('display','none');
        }
    });

    //when the player's mouse enters a tile
    $('.player-tile').on('mouseenter',function(){
        currentTileId = $(this).attr('id');
        tileOnEnter(currentTileId);
    });

    //when the player's mouse leaves a tile
    $('.player-tile').on('mouseleave',function(){
        tileOnLeave(currentTileId);
    });

    //when the player clicks a tile
    $('.player-tile').on('click',function(){
        currentTileId = $(this).attr('id');
        tileOnClick(currentTileId);
    });

    //when the player's mouse enters an enemy tile
    $('.enemy-tile').on('mouseenter',function(){
        currentTileIdEnemy = $(this).attr('id');
        tileEnemyOnEnter(currentTileIdEnemy);
    });

    //when the player's mouse leaves an enemy tile
    $('.enemy-tile').on('mouseleave',function(){
        tileEnemyOnLeave(currentTileIdEnemy);
    });

    //when the player clicks an enemy tile
    $('.enemy-tile').on('click',function(){
        currentTileIdEnemy = $(this).attr('id');
        tileEnemyOnClick(currentTileIdEnemy);
    });

    //when the player presses the r key
    $(document).on('keydown',function(e){
        //change ship placement orientation
        if(e.which == 82 && currentTileId){
            dehighlightShips(currentTileId);
            if(currentShipOrientation == 0){
                currentShipOrientation = 1;
            }
            else{
                currentShipOrientation =0;
            }
            highlightShips(currentTileId);
        }
    });

    //when the player scrolls the mouse wheel
    $(document).on('mousewheel', function(e) {
        //change the ship placement orientation
        if(currentTileId){
            dehighlightShips(currentTileId);
            if(currentShipOrientation == 0){
                currentShipOrientation = 1;
            }
            else{
                currentShipOrientation =0;
            }
            highlightShips(currentTileId);
        }
    });

    if(loadGameId != "empty"){
        //if the player is loading a game
        loadData();
    }
    else if(joinPlayerId != "empty"){
        //if the player is joining a specific player
        joinPlayer();
    }
    else{
        //if the player is joining the queue
        joinGame();
    }
    //ask to update player socket id on server
    socket.emit('update socket',fullid);

});

//loads the game data based on info from the view
function loadData(){
    gameId = loadGameId;
    shipsBoard = convertStringToMatrix($("#ships-board").text());
    missilesBoard = convertStringToMatrix($("#missiles-board").text());
    outcomesBoard = convertStringToMatrix($("#outcomes-board").text());
    enemyMissilesBoard = convertStringToMatrix($("#enemy-missiles-board").text());

    sunkedShips = convertStringToArray($("#sunked-ships").text());
    mySunkShips = convertStringToArray($("#my-sunked-ships").text());

    currentGameState = $("#current-game-state").text();
    enemyPlacedShips = convertStringToBoolean($("#enemy-placed-ships").text());
    myTurn = convertStringToBoolean($("#my-turn").text());

    loadShipsOrientation();

    app.$data.points = parseInt($("#score").text());

    //update the view boards' images
    updateView();
}

//load the ships orientations
function loadShipsOrientation(){
    var array = convertStringToArray($('ships-orientation').text());

    var keys = Array.from(shipsOrientation.keys());

    for(var i = 0; i < keys.length; i++){
        shipsOrientation.set(keys[i],array[i]);
    }
}

function updateView(){
    //update the player's board images
    for(var i = 0; i < gridX; i++){
        for(var j = 0; j < gridY; j++){
            if(shipsBoard[i][j] != "empty"){
                if(shipsOrientation.get(shipsBoard[i][j]) == "vertical")
                {
                    if(enemyMissilesBoard[i][j] != "empty"){
                        $('#player-grid-'+j+'-'+i).attr('src','/images/shipmoduledestroyedredvertical.png');
                    }
                    else{
                        $('#player-grid-'+j+'-'+i).attr('src','/images/shipmodulevertical.png');
                    }
                }
                else{
                    if(enemyMissilesBoard[i][j] != "empty"){
                        $('#player-grid-'+j+'-'+i).attr('src','/images/shipmoduledestroyedredhorizontal.png');
                    }
                    else{
                        $('#player-grid-'+j+'-'+i).attr('src','/images/shipmodulehorizontal.png');
                    }
                }
            }
            else{
                if(enemyMissilesBoard[i][j] != "empty"){
                    $('#player-grid-'+j+'-'+i).attr('src','/images/tilefail.png');
                }
            }
        }
    }

    //update the enemy's board images
    for(var i = 0; i < gridX; i++){
        for(var j = 0; j < gridY; j++){
            if(missilesBoard[i][j] != "empty"){
                if(outcomesBoard[i][j] != "no ship"){
                    $('#enemy-grid-'+j+'-'+i).attr('src','/images/shipmoduledestroyedred.png');
                }
                else{
                    $('#enemy-grid-'+j+'-'+i).attr('src','/images/tilefail.png');
                }
            }
        }
    }

    //check if the other player had already joined
    checkJoin();
}

function checkJoin(){
    var wait = convertStringToBoolean($("#wait").text());
    if(wait){
        //if it had already joined, show the game and alert this player
        enemy = $("#enemy-player").text();
        showGame();
        alert('Welcome back with ' + enemy);
    }
}

//called when the player joins another player in specific
function joinPlayer(){
    gameId = joinPlayerId;
    var wait = convertStringToBoolean($("#wait").text());
    if(wait){
        //if the other player had already joined, show the game and alert this player
        enemy = $("#enemy-player").text();
        showGame();
        myTurn = false;
        app.$data.turn = "Waiting for oponent...";
    }
}

//called when the player joins the queue
function joinGame(){
    socket.emit('join game',username+"("+email+")");
}

//Received when the other player want to update his score on this player's view
function handleUpdateScore(msg){
    app.$data.pointsEnemy = msg;
}

//Received when another player joined the queue
function handleAcceptedGame(msg){
    //set some variables, show the game and alert this player
    enemy = msg.split('#')[0];
    gameId = msg.split('#')[1];
    var turn = msg.split('#')[2];
    showGame();
    alert('You were joined with '+ enemy);
    if(turn == "first"){
        myTurn = true;
        app.$data.turn = "It's your Turn!";
    }
    else{
        myTurn = false;
        app.$data.turn = "Waiting for oponent...";
    }
}

//Received when the other player denies the join request
function handleJoinRequestDenied(msg){
    //warn this player and change the page
    alert(msg+" rejected your request...");
    window.location.replace("/lobby");
}

//Received when the other player accepts the join request
function handleAcceptedJoinPlayer(msg){
    var player = msg.split('#')[0];
    if(player == fullid){
        //warn this player, show the game and set some variables
        gameId = msg.split('#')[2];
        enemy = msg.split('#')[1];
        showGame();
        alert(msg + " accepted to play with you!");
        myTurn = true;
        app.$data.turn = "It's your Turn!";
    }
}

//Received when the other player forfeits the game
function handlePlayerForfeit(msg){
    //alert this player and finish the game
    alert("The other player forfeited");
    currentGameState = "Finished";
    app.$data.state = "Finished";
    app.$data.turn = "The enemy forfeited the game. You won!";
    socket.emit('game ended',fullid);
    socket.emit('save victory',email);
    $('#save').css('display','none');
    $('#forfeit').css('display','none');
    saveGameScore();
}

//Received when the other player finishes placing his ships
function handleEnemyPlacedShips(msg){
    //update the game state, set some variables and alert the player
    if(currentGameState == "Waiting For Enemy Placing"){
        //if this player had already placed his ships
        currentGameState = "Playing";
        app.$data.state = "Playing";
    }
    enemyPlacedShips = true;
    alert('The other player finished placing his ships');
}

//Received when the other player places a missile
function handlePlacedMissile(msg){
    //get the missile position
    var x = parseInt(msg.split('#')[0]);
    var y = parseInt(msg.split('#')[1]);

    //get the ship on that location
    var ship = shipsBoard[x][y];

    //update the enemy placement matrix
    enemyMissilesBoard[x][y] = "placed";

    if(ship == 'empty'){
        //if enemy failed, set the tilefail image and play water sound
        $('#player-grid-'+y+'-'+x).attr('src','/images/tilefail.png');
        waterSound.play();

        //set turn and state
        myTurn = true;
        app.$data.turn = "It's your Turn!";
        currentGameState = "Playing";
        app.$data.state = "Playing";
    }
    else{
        //if enemy hits a ship
        //change ship image depending on the ships orientation
        if(shipsOrientation.get(ship) == 'vertical'){
            $('#player-grid-'+y+'-'+x).attr('src','/images/shipmoduledestroyedredvertical.png');
        }
        else{
            $('#player-grid-'+y+'-'+x).attr('src','/images/shipmoduledestroyedredhorizontal.png');
        }
        if(checkEnemySink(ship)){
            //if the ship has sunk
            mySunkShips.push(ship);

            alert("The enemy has sunk your "+ ship);

            if(mySunkShips.length >= ships.size){
                //if all ships were sunk
                //alert this player, the other player with the outcome and finish the game
                alert("You lost the game :(");
                socket.emit('game ended',fullid);
                socket.emit('save defeat',email);
                currentGameState = "Finished";
                app.$data.state = "Finished";
                app.$data.turn = "You lost the game :(";
                socket.emit('missile outcome',gameId+"#"+fullid+"#"+x+"#"+y+"#"+ship);
                $('#save').css('display','none');
                $('#forfeit').css('display','none');
                saveGameScore();
                return;
            }
            else{
                bigExplosionSound.play();
            }
        }
        else{
            explosionSound.play();
        }

        //set turn and state
        myTurn = false;
        app.$data.turn = "Waiting for Oponent...";
    }
    //send the missile placement outcome to the other player
    socket.emit('missile outcome',gameId+"#"+fullid+"#"+x+"#"+y+"#"+ship);
}

//Received when the other player returns the missile placement outcome
function handleMissileOutcome(msg){
    //get the position of placement
    var x = parseInt(msg.split('#')[0]);
    var y = parseInt(msg.split('#')[1]);

    //get the outcome
    var ship = msg.split('#')[2];


    if(ship != 'empty'){
        //if it hit a ship
        //change image, update score
        $('#enemy-grid-'+y+'-'+x).attr('src','/images/shipmoduledestroyedred.png');

        outcomesBoard[x][y] = ship;

        app.$data.points += 10*streak;

        if(checkShipSink(ship)){
            //if the ship is sunk
            //update score and alert the player
            sunkedShips.push(ship);

            app.$data.points += ships.get(ship)*10*streak;
            alert("You sunk the enemy's "+ ship);
                
            if(sunkedShips.length >= ships.size){
                //if all ships were sunk
                //alert this player and finish the game
                alert("Congrats! You won the game!");
                socket.emit('game ended',fullid);
                socket.emit('save victory',email);
                currentGameState = "Finished";
                app.$data.state = "Finished";
                app.$data.turn = "Congrats! You won the game!";
                $('#save').css('display','none');
                $('#forfeit').css('display','none');
                saveGameScore();
                return;
            }
            else{
                bigExplosionSound.play();
            }
        }
        else{
            explosionSound.play();
        }
        //update the streak
        streak += 0.2;

        //set turn and state
        myTurn = true;
        app.$data.turn = "It's your Turn!";

        //request the other player to update this player's score
        socket.emit('update score',gameId+"#"+fullid+"#"+app.$data.points);
    }
    else{
        //if the outcome is water
        //update image and set the streak to 1 again
        $('#enemy-grid-'+y+'-'+x).attr('src','/images/tilefail.png');
        outcomesBoard[x][y] = "no ship";
        waterSound.play();
        streak = 1.0;

        //set turn and state
        myTurn = false;
        app.$data.turn = "Waiting for Oponent...";
    }

    currentGameState = "Playing";
    app.$data.state = "Playing";
}

//Called when the game get finished, warns the server to save this player's score
function saveGameScore(){
    socket.emit('save score',gameId+"#"+fullid+"#"+app.$data.points);
}

//Received when the other player requests to save the game
function handleSaveGame(msg){
    //ask this player if he wants to save the game
    var answer = confirm("Your oponent wants to save this game for later, do you accept his request?");
    if(answer){
        //if he wants, finish the game and send the game state to server
        socket.emit('game ended',fullid);
        sendWholeStateToServer();
        //warn the other player
        socket.emit('save accepted',gameId+"#"+fullid)
    }
    else{
        //warn the other player in case of denied request
        socket.emit('save denied',gameId+"#"+fullid);
    }
}

//Called when the player wants to save the game
//It sends the whole state of the game to the server in a string 
function sendWholeStateToServer(){
    var wholeState = "";
    wholeState += convertMatrixToString(shipsBoard);
    wholeState += "#"+convertMatrixToString(missilesBoard);
    wholeState += "#"+convertMatrixToString(outcomesBoard);
    wholeState += "#"+convertMatrixToString(enemyMissilesBoard);

    wholeState += "#"+convertArrayToString(sunkedShips);
    wholeState += "#"+convertArrayToString(mySunkShips);

    wholeState += "#"+currentGameState;

    wholeState += "#"+enemyPlacedShips;

    wholeState += "#"+myTurn;

    wholeState += "#"+app.$data.points;

    wholeState += "#"+convertArrayToString(Array.from(shipsOrientation.values()));

    //Send to server
    socket.emit('save state',gameId+"#"+fullid+"#"+wholeState);
}

//converts an array into a string
function convertArrayToString(array){
    var result;
    if(array.length <= 0){
        result = "empty";
    }
    else{
        result = "";
        for(var i = 0; i < array.length; i++){
            if(i < array.length - 1){
                result += array[i]+",";
            }
            else{
                result += array[i];
            }
        }
    }
    return result;
}

//converts the string back to an array
function convertStringToArray(string){
    var result = [];
    if(string != "empty"){
        var aux = string.split(',');
        for(var i = 0; i < aux.length; i++){
            result.push(aux[i]);
        }
    }
    return result;
}

//converts a matrix to a string
function convertMatrixToString(matrix){
    var result = "";
    for(var i = 0; i < matrix.length; i++){
        for(var j = 0; j < matrix[i].length; j++){
            if(j < matrix[i].length - 1){
                result += matrix[i][j]+",";
            }
            else{
                result += matrix[i][j];
            }
        }
        if(i < matrix.length - 1){
            result += ";";
        }
    }
    return result;
}   

//converts the string back to a matrix
function convertStringToMatrix(string){
    var result;
    var lines = string.split(';');
    var result = new Array(lines.length);
    for(var i = 0; i < lines.length; i++){
        var elements = lines[i].split(',');
        result[i] = new Array(elements.length);
        for(var j = 0; j < elements.length; j++){
            result[i][j] = elements[j];
        }
    }
    return result;
}

//converts a string to a boolean
function convertStringToBoolean(string){
    if(string == "true"){
        return true;
    }
    else{
        return false;
    }
}

//Received when the other player refuses to save the game
function handleSaveDenied(msg){
    alert("Your oponent denied your request.");
}

//Received when the other player accepts to save the game
function handleSaveAccepted(msg){
    //finish game and send game state to server
    socket.emit('game ended',fullid);
    sendWholeStateToServer();
    alert("Your oponent accepted your request, the game is going to be saved.");
}

//Received when the other player accepts to load the game
function handleAcceptedLoad(msg){
    var player = msg.split('#')[0];
    //check if the message is directed to this player
    if(fullid == player){
        //show game, update some variables and alert the player
        enemy = msg.split('#')[1];
        gameId = msg.split('#')[2];
        showGame();
        alert(enemy + 'accepted to join game');
    }
}

//Received when the player enter another game on another window
function handleNotAllowedToJoin(){
    alert("You're already playing on another window. Please play one game at a time");
    window.location.replace("/");
}

//returns true if the ship is sunk
function checkShipSink(ship){
    var count = 0;
    for(var i = 0; i < gridX; i++){
        for(var j = 0; j < gridY; j++){
            if(outcomesBoard[i][j] == ship){
                count++;
            }
        }
    }

    if(count >= ships.get(ship)){
        return true;
    }
    return false;
}

//returns true if the enemy ship is sunk
function checkEnemySink(ship){
    var count = 0;
    for(var i = 0; i < gridX; i++){
        for(var j = 0; j < gridY; j++){
            if(enemyMissilesBoard[i][j] == "placed" && shipsBoard[i][j] == ship){
                count++;
            }
        }
    }

    if(count >= ships.get(ship)){
        return true;
    }
    return false;
}

//show the loading screen
function showLoading(){
    $('#game').css('display','none');
    $('#waiting').css('display','block');
}

//show the game screen
function showGame(){
    $('#game').css('display','block');
    $('#waiting').css('display','none');
}

//Called when the player enters a tile
function tileOnEnter(id){
    if(currentGameState == "Placing Ships"){
        highlightShips(id);
    }
    else if(currentGameState == "Playing"){
        //DO NOTHING
    }
    else if(currentGameState == "Waiting"){
        //DO NOTHING
    }
    else if(currentGameState == "Finished"){
        //DO NOTHING
    }
}

//Called when the player leaves a tile
function tileOnLeave(id){
    currentTileId = null;
    if(currentGameState == "Placing Ships"){
        dehighlightShips(id);
    }
    else if(currentGameState == "Playing"){
        //DO NOTHING
    }
    else if(currentGameState == "Waiting"){
        //DO NOTHING
    }
    else if(currentGameState == "Finished"){
        //DO NOTHING
    }
}

//Called when the player enters an enemy tile
function tileEnemyOnEnter(id){
    if(currentGameState == "Placing Ships"){
        //DO NOTHING
    }
    else if(currentGameState == "Playing"){
        if(myTurn){
            highlightLocation(id);
        }
    }
    else if(currentGameState == "Waiting"){
        //DO NOTHING
    }
    else if(currentGameState == "Finished"){
        //DO NOTHING
    }
}

//Called when the player leaves an enemy tile
function tileEnemyOnLeave(id){
    currentTileIdEnemy = null;
    if(currentGameState == "Placing Ships"){
        //DO NOTHING
    }
    else if(currentGameState == "Playing"){
        if(myTurn){
            dehighlightLocation(id);
        }
    }
    else if(currentGameState == "Waiting"){
        //DO NOTHING
    }
    else if(currentGameState == "Finished"){
        //DO NOTHING
    }
}

//highlights tiles based on ship size, orientation, position and if it can be placed
function highlightShips(id){
    //get ship info
    var shipName = shipsIndexes.get(currentShip);
    var shipSize = ships.get(shipName);

    //green highlight color
    var color = 'hue-rotate(270deg)';

    var x = parseInt(id.split('-')[3]);
    var y = parseInt(id.split('-')[2]);

    //if it doesn't fit the board or has collisions with others ships
    if(!checkFits(id) || !collisionWithShips(id)){
        //orange highlight color
        color = 'hue-rotate(180deg)';
    }

    //change the color of the center tile
    $('#'+id).css('filter',color);
    
    if(currentShipOrientation == 0){
        //if the ship is oriented vertically

        //paint the others tiles above and below the center tile
        var place = "above";
        var above = 1;
        var below = 1;
        var newY;
        for(var i = 0; i < shipSize - 1; i++){
            if(place == "above"){
                place = "below";
                newY = y - above;
                $('#player-grid-'+newY+'-'+x).css('filter',color);
                above++;
            }
            else{
                place = "above";
                newY = y + below;
                $('#player-grid-'+newY+'-'+x).css('filter',color);
                below++;
            }
        }
    }   
    else{
        //if the ship is oriented horizontally

        //paint the others tiles to the right and left of the center tile
        var place = "right";
        var right = 1;
        var left = 1;
        var newX;
        for(var i = 0; i < shipSize - 1; i++){
            if(place == "right"){
                place = "left";
                newX = x + right;
                $('#player-grid-'+y+'-'+newX).css('filter',color);
                right++;
            }
            else{
                place = "right";
                newX = x - left;
                $('#player-grid-'+y+'-'+newX).css('filter',color);
                left++;
            }
        }
    }
}

//returns true if the current ship fits the board on the current positioning and orientation
function checkFits(id){
    //get ship info
    var shipName = shipsIndexes.get(currentShip);
    var shipSize = ships.get(shipName);

    //get the positioning
    var x = parseInt(id.split('-')[3]);
    var y = parseInt(id.split('-')[2]);

    
    if(currentShipOrientation == 1){
        //if the ship is oriented horizontally
        if(isEven(shipSize)){
            var halfFront = Math.ceil((shipSize - 1)/2);
            var halfBack = Math.floor((shipSize - 1)/2);
            return (((x - halfBack)>=0)&&((x + halfFront)<gridX));
        }
        else{
            var half = ((shipSize - 1)/2);
            return (((x - half)>=0)&&((x + half)<gridX));
        }
    }
    else{
        //if the ship is oriented vertically
        if(isEven(shipSize)){
            var halfBack = Math.ceil((shipSize - 1)/2);
            var halfFront = Math.floor((shipSize - 1)/2);
            return (((y - halfBack)>=0)&&((y + halfFront)<gridY));
        }
        else{
            var half = ((shipSize - 1)/2);
            return (((y - half)>=0)&&((y + half)<gridY));
        }
    }
}

//returns true if the current ship has collisions with other ships on the current positioning and orientation
function collisionWithShips(id){
    //get ship info
    var shipName = shipsIndexes.get(currentShip);
    var shipSize = ships.get(shipName);

    //get the positioning
    var x = parseInt(id.split('-')[3]);
    var y = parseInt(id.split('-')[2]);

    //if the center tile has collisions, when can return false
    if(shipsBoard[x][y] != 'empty'){
        return false;
    }

    //check the other tiles
    if(currentShipOrientation == 0){
        //if the ship is oriented vertically
        //check tiles above and below the center tile
        var place = "above";
        var above = 1;
        var below = 1;
        var newY;
        for(var i = 0; i < shipSize - 1; i++){
            if(place == "above"){
                place = "below";
                newY = y - above;
                if(shipsBoard[x][newY] != 'empty'){
                    return false;
                }
                above++;
            }
            else{
                place = "above";
                newY = y + below;
                if(shipsBoard[x][newY] != 'empty'){
                    return false;
                }
                below++;
            }
        }
    }   
    else{
        //if the ship is oriented horizontally
        //check tiles to the right and left of the center tile
        var place = "right";
        var right = 1;
        var left = 1;
        var newX;
        for(var i = 0; i < shipSize - 1; i++){
            if(place == "right"){
                place = "left";
                newX = x + right;
                if(shipsBoard[newX][y] != 'empty'){
                    return false;
                }
                right++;
            }
            else{
                place = "right";
                newX = x - left;
                if(shipsBoard[newX][y] != 'empty'){
                    return false;
                }
                left++;
            }
        }
    }
    //if there were no collisions, return true
    return true;
}

//returns true if val is even
function isEven(val){
    return (val%2 == 0);
}

//removes all filters from all player tiles
function dehighlightBoard(){
    for(var i = 0; i < gridX; i++){
        for(var j = 0; j < gridY; j++){
            $('#player-grid-'+j+'-'+i).css('filter','none');
        }
    }
}

//dehighlights tiles based on ship positioning and orientation
function dehighlightShips(id){
    //get ship info
    var shipName = shipsIndexes.get(currentShip);
    var shipSize = ships.get(shipName);

    //get ship positioning
    var x = parseInt(id.split('-')[3]);
    var y = parseInt(id.split('-')[2]);

    //dehighlight the center tile
    $('#'+id).css('filter','none');
    
    //dehighlight the other tiles
    if(currentShipOrientation == 0){
        //if the ship is oriented vertically
        //dehighlight tiles above and below the center tile
        var place = "above";
        var above = 1;
        var below = 1;
        var newY;
        for(var i = 0; i < shipSize - 1; i++){
            if(place == "above"){
                place = "below";
                newY = y - above;
                $('#player-grid-'+newY+'-'+x).css('filter','none');
                above++;
            }
            else{
                place = "above";
                newY = y + below;
                $('#player-grid-'+newY+'-'+x).css('filter','none');
                below++;
            }
        }
    }   
    else{
        //if the ship is oriented horizontally
        //dehighlight tiles to the right and left of the center tile
        var place = "right";
        var right = 1;
        var left = 1;
        var newX;
        for(var i = 0; i < shipSize - 1; i++){
            if(place == "right"){
                place = "left";
                newX = x + right;
                $('#player-grid-'+y+'-'+newX).css('filter','none');
                right++;
            }
            else{
                place = "right";
                newX = x - left;
                $('#player-grid-'+y+'-'+newX).css('filter','none');
                left++;
            }
        }
    }
}

//highlight a location on the enemy board for missile placement
function highlightLocation(id){
    //get the position
    var x = parseInt(id.split('-')[3]);
    var y = parseInt(id.split('-')[2]);

    if(missilesBoard[x][y] == 'empty'){
        //if already placed, highlight orange
        $('#'+id).css('filter','hue-rotate(270deg)');
    }
    else{
        //otherwise, highlight green
        $('#'+id).css('filter','hue-rotate(180deg)');
    }
}

//dehighlights a location on the enemy board(removes filter)
function dehighlightLocation(id){
    $('#'+id).css('filter','none');
}

//Called when player clicks on a tile
function tileOnClick(id){
    if(currentGameState == "Placing Ships"){
        placeShip(id);
    }
    else if(currentGameState == "Playing"){
        //DO NOTHING
    }
    else if(currentGameState == "Waiting"){
        //DO NOTHING
    }
    else if(currentGameState == "Finished"){
        //DO NOTHING
    }
}

//Called when player clicks on an enemy tile
function tileEnemyOnClick(id){
    if(currentGameState == "Placing Ships"){
        //DO NOTHING
    }
    else if(currentGameState == "Playing"){
        if(myTurn){
            placeMissile(id);
        }
    }
    else if(currentGameState == "Waiting"){
        //DO NOTHING
    }
    else if(currentGameState == "Finished"){
        //DO NOTHING
    }
}

//places the current ship at the current location and orientation
function placeShip(id){
    //check if it fits the board and has collisions with other ships
    if(!checkFits(id) || !collisionWithShips(id)){
        return;
    }

    //get ship info
    var shipName = shipsIndexes.get(currentShip);
    var shipSize = ships.get(shipName);

    //get the ship positioning
    var x = parseInt(id.split('-')[3]);
    var y = parseInt(id.split('-')[2]);

    //set center tile on ships matrix
    shipsBoard[x][y] = shipName;

    if(currentShipOrientation == 0){
        //if the ship is oriented vertically
        //set ships matrix, ship orientation and image on center tile
        shipsOrientation.set(shipName,'vertical');
        $('#'+id).attr('src','/images/shipmodulevertical.png');
        var place = "above";
        var above = 1;
        var below = 1;
        var newY;
        for(var i = 0; i < shipSize - 1; i++){
            //do the same for the rest of the tiles above and below
            if(place == "above"){
                place = "below";
                newY = y - above;
                shipsBoard[x][newY] = shipName;
                $('#player-grid-'+newY+'-'+x).attr('src','/images/shipmodulevertical.png');
                above++;
            }
            else{
                place = "above";
                newY = y + below;
                shipsBoard[x][newY] = shipName;
                $('#player-grid-'+newY+'-'+x).attr('src','/images/shipmodulevertical.png');
                below++;
            }
        }
    }   
    else{
        //if the ship is oriented horizontally
        //set ships matrix, ship orientation and image on center tile
        shipsOrientation.set(shipName,'horizontal');
        $('#'+id).attr('src','/images/shipmodulehorizontal.png');
        var place = "right";
        var right = 1;
        var left = 1;
        var newX;
        for(var i = 0; i < shipSize - 1; i++){
            //do the same for the rest of the tiles above and below
            if(place == "right"){
                place = "left";
                newX = x + right;
                shipsBoard[newX][y] = shipName;
                $('#player-grid-'+y+'-'+newX).attr('src','/images/shipmodulehorizontal.png');
                right++;
            }
            else{
                place = "right";
                newX = x - left;
                shipsBoard[newX][y] = shipName;
                $('#player-grid-'+y+'-'+newX).attr('src','/images/shipmodulehorizontal.png');
                left++;
            }
        }
    }

    //dehighlight tiles
    dehighlightBoard();
    //play ships placement sound
    placeShipSound.play();
    //set current ship to the next ship
    currentShip++;

    //if it has already player all ships
    if(currentShip >= shipsIndexes.size){
        if(!enemyPlacedShips){
            //wait for the enemy to place if he hasn't placed yet
            currentGameState = "Waiting For Enemy Placing";
            app.$data.state = "Waiting For Enemy Placing";
        }
        else{
            //play game if the enemy already placed his ships
            currentGameState = "Playing";
            app.$data.state = "Playing";
        }
        //warn the other player
        socket.emit('placed ships',gameId+"#"+fullid);
    }
}

//Called when the player places a missile on the enemy board
function placeMissile(id){
    //get the positioning of the missile
    var x = parseInt(id.split('-')[3]);
    var y = parseInt(id.split('-')[2]);

    //check if a missile has already been placed there
    var location = missilesBoard[x][y];
    if(location != "empty"){
        alert("You have already placed a missile there");
    }
    else{
        //if not, warn the other player with the positioning and wait for the outcome
        socket.emit('placed missile',gameId+"#"+fullid+"#"+x+"#"+y);
        missilesBoard[x][y] = "placed";
        currentGameState = "Waiting For Missile Outcome";
        app.$data.state = "Waiting For Missile Outcome";
        dehighlightLocation(id);
    }
}
