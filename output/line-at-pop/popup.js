$(function(){

    $(document).off('click','#line_overlay_close');
    $(document).on('click','#line_overlay_close',function() {

        var returnUrl = location.href;

        if (returnUrl == null || returnUrl == undefined) {
            returnUrl = '';
        }

        location.href = returnUrl;
    });

    if( window.history && window.history.pushState ) {
        //. ブラウザ履歴に１つ追加
        history.pushState( "cliniclp", null, "" );

        $(window).on( "popstate", function(event) {
            //. このページで「戻る」を実行
            if( !event.originalEvent.state ) {

                //alert("ajax前");
                var path = location.protocol + '//' + location.host;

                $.post(path + '/line-at-pop/line-at-url.php', null, function(data) {
                    //alert(data);
                    //alert(data["url"]);
                    //alert($.cookie('ad_id'));

                    if(data["url"] !== "") {

                        var ad_id = 0;

                        if($.cookie('ad_id') === null) {
                            ad_id = 0;
                        } else {
                            ad_id = $.cookie('ad_id');
                        }

                        var line_url = data["url"];
                        var linepopup_img = data["img"];

                        $.ajax({
                            type:'POST',
                            url:path + '/line-at-pop/lineat_increment.php',
                            data:{
                                ad_id:ad_id,
                                status_id:"0"
                            }
                        });

                        var lp_overlay =
                            '<div id="line" style="opacity: 0;">'+
                            '<p class="button"><button id="line_overlay_close" class="cross_button next close"></button></p>'+
                            '<p class="img_note"><a href="' + line_url + '"><img src="' + path + '/line-at-pop/img/' + linepopup_img + '" alt="" width="560" height="625"></a></p>'+
                            '<div class="popup_cover"></div>'+
                            '</div>';
                            $('body').append(lp_overlay);
                            $("#line").stop().animate({opacity:'1'},1000);

                        //. もう一度履歴を操作して終了
                        history.pushState( "cliniclp", null, "" );
                    }
                });

            return;

            }
        });
    }
});