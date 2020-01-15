const passwordRegex = /^[a-zA-Z0-9\-\_]{3,}$/;
var passwordValidation;
var alreadyChecked;
var originalBorder;

function checkPassword(){
    var text = $("#password").val();
    if(!passwordRegex.test(text)){
        passwordValidation = false;
        $("#password").css("border-color","red");
        $("#passwordHelp").css("display","block");
    }
    else{
        $("#password").css("border-color",originalBorder);
        $("#passwordHelp").css("display","none");
        var retype = $("#confirmPassword").val();
        if(retype == text){
            passwordValidation = true;
            $("#confirmPassword").css("border-color",originalBorder);
            $("#retypeHelp").css("display","none");
        }
        else{
            passwordValidation = false;
            $("#confirmPassword").css("border-color","red");
            $("#retypeHelp").css("display","block");
        }
    }
}  

$(document).ready(function(){
    passwordValidation = false;
    alreadyChecked = false;
    originalBorder = $("#password").css("border-color");

    $("#confirmPassword").on("input",function(){
        if(alreadyChecked){
            checkPassword();
        }
    });

    $("#password").on("focusout",function(){
        checkPassword();
    });

    $("#confirmPassword").on("input",function(){
        if(alreadyChecked){
            checkPassword();
        }
    });

    $("#confirmPassword").on("focusout",function(){
        checkPassword();
    });

    $("#submit").on("click",function(){
        $("form").on("submit",function (e) {
            e.preventDefault();
        });
        checkPassword();
        alreadyChecked = true;
        if(passwordValidation){
            $("form").unbind('submit');
        }
    });
});