const emailRegex = /^[a-zA-Z0-9\-\_]+@[a-zA-Z0-9]+\.[a-zA-Z0-9]+$/;
var emailValidation;
var alreadyChecked;
var originalBorder;


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

$(document).ready(function(){
    emailValidation = false;
    alreadyChecked = false;
    originalBorder = $("#email").css("border-color");

    $("#email").on("input",function(){
        if(alreadyChecked){
            checkEmail();
        }
    });

    $("#email").on("focusout",function(){
        checkEmail();
    });

    $("#submit").on("click",function(){
        $("form").on("submit",function (e) {
            e.preventDefault();
        });
        checkEmail();
        alreadyChecked = true;
        if(emailValidation){
            $("form").unbind('submit');
        }
    });
});