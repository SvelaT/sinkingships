//socket
var socket;

//player credentials
var username;
var email;

//this is a variable containing data in the following format username(email), used to identify the player in the socket messages
var fullid;

//current players on the lobby
var lobbyPlayers = [];

//html of the join player button
const joinPlayerButton = "<a class=\"btn btn-primary\" style=\"margin-left: 5px;\" href=\"/game/player/";

//when the document is ready
$(document).ready(function(){
    //get user credentials
    username = $('#current-user').text();
    email = $('#current-user-email').text();
    fullid = username+"("+email+")";

    //configure the socket callbacks
    socket = new io();
    socket.on('update',handleNewMessage);
    socket.on('lobby players',handleLobbyPlayers);
    socket.on('add player',handleAddPlayer);
    socket.on('exit from lobby',handleExitFromLobby);
    socket.on('join request',handleJoinRequest);

    //hide these html elements
    $('#find-game').css('display','none');
    $('#message-field').css('display','none');
    $('#submit-message').css('display','none');

    //if the player joins the lobby
    $('#join-lobby').on('click',function(){
        $(this).css('display','none');
        //show the chat, message field and button
        $('#find-game').css('display','block');
        $('#message-field').css('display','block');
        $('#submit-message').css('display','block');
        //call the server to join the lobby
        joinLobby();
    });
    //if player presses submit message or presses the enter key
    $('#submit-message').on('click',submitMessage);
    $(document).on('keydown',function(e){
        if(e.which == 13){
            submitMessage();
        }
    });
});

//if the player joins the lobby
function joinLobby(){
    //warn the server
    if(email){
        socket.emit('join lobby',username+"("+email+")");
    }
    else{
        socket.emit('join lobby','anonymous');
    }
}

//Received when the server sends a new message
function handleNewMessage(msg){
    $('#lobby-chat').append("<p>"+msg+"</p>");
}

//Received when the player enters the lobby page
function handleLobbyPlayers(msg){
    //show all the players on the lobby players section
    var players = msg.split('#');
    for(var index in players){
        if(players[index] != fullid && !lobbyPlayers.includes(players[index])){
            var playerUsername = players[index].split('(')[0];
            lobbyPlayers.push(players[index]);
            var id = lobbyPlayers.indexOf(players[index]);
            $('#lobby-players').append("<div id=\"player-id-"+id+"\" class=\"lobby-player\"><p>"+playerUsername+"</p>"+joinPlayerButton+players[index]+"\">Join With Player</a></div>");
        }
    }
}

//Received when a player joins the lobby
function handleAddPlayer(player){
    //display the player on the lobby players section
    var playerUsername = player.split('(')[0];
    if(username+"("+email+")" != player && !lobbyPlayers.includes(player)){
        lobbyPlayers.push(player);
        var id = lobbyPlayers.indexOf(player);
        $('#lobby-players').append("<div id=\"player-id-"+id+"\" class=\"lobby-player\"><p>"+playerUsername+"</p>"+joinPlayerButton+player+"\">Join With Player</a></div>");
    }
}

//Received when a player leaves the lobby
function handleExitFromLobby(player){
    //remove the player from the lobby players section
    if(lobbyPlayers.includes(player)){
        var index = lobbyPlayers.indexOf(player);
        lobbyPlayers.splice(index,1);
        $("#player-id-"+index).remove();
        $('#lobby-chat').append("<p>Server: "+player+" has left the lobby...</p>");
    }   
}

//Received when a player requests to play with this player
function handleJoinRequest(player){
    //ask the player for confirmation
    var answer = confirm(player+" wants to play with you! Do you accept the request?");
    if(answer){
        window.location.replace("/game/player/"+player);
    }
    else{
        socket.emit('join request denied',fullid);
    }
}

//Called when a player submits a message
function submitMessage(){
    if($('#message-field').val() != ""){
        socket.emit('lobby message',username+": "+$('#message-field').val());
        $('#message-field').val("");
    }
}