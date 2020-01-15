const emailRegex = /^[a-zA-Z0-9\-\_\.]+@[a-zA-Z0-9\.]+\.[a-zA-Z0-9]+$/;
const usernameRegex = /^[a-zA-Z0-9 ]+$/;
const passwordRegex = /^[a-zA-Z0-9\-\_]{3,}$/;
var emailValidation;
var passwordValidation;
var usernameValidation;
var alreadyChecked;
var originalBorder;

function checkUsername(){
    var text = $("#username").val();
    if(!usernameRegex.test(text)){
        usernameValidation = false;
        $("#username").css("border-color","red");
        $("#usernameHelp").css("display","block");
    }
    else{
        usernameValidation = true;
        $("#username").css("border-color",originalBorder);
        $("#usernameHelp").css("display","none");
    }
}  

function checkEmail(){
    var text = $("#email").val();
    if(!emailRegex.test(text)){
        emailValidation = false;
        $("#email").css("border-color","red");
        $("#emailHelp").css("display","block");
    }
    else{
        emailValidation = true;
        $("#email").css("border-color",originalBorder);
        $("#emailHelp").css("display","none");
    }
}    

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
    emailValidation = false;
    usernameValidation = false;
    passwordValidation = false;
    alreadyChecked = false;
    originalBorder = $("#email").css("border-color");

    $("#username").on("input",function(){
        if(alreadyChecked){
            checkUsername();
        }
    });

    $("#username").on("focusout",function(){
        checkUsername();
    });

    $("#email").on("input",function(){
        if(alreadyChecked){
            checkEmail();
        }
    });

    $("#email").on("focusout",function(){
        checkEmail();
    });

    $("#password").on("input",function(){
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
        checkUsername();
        checkEmail();
        checkPassword();
        alreadyChecked = true;
        if(emailValidation && passwordValidation && usernameValidation){
            $("form").unbind('submit');
        }
    });
});
