// pages/info/info.js
import Toast from '@vant/weapp/toast/toast';

Page({

  /**
   * 页面的初始数据
   */
    data: {
        sentext: "发送",                     //发送键位按钮里面的信息
        msgLoad: true,                       //确保在gpt回答的时候不能再发送信息过去           
        msgList: [{                          //保存msgLIst，以便在页面显示聊天记录
            my: false,
            msg: "你好呀,想问什么就问吧",
            id: "unique_id_1"
        }],
        msg: "",                             //是user input
        contentHeight: "",                  //对话宽的高度设置，不能设为screenHeight，因为不够长的话，手机键盘输入，无法往上拉动，导致输入框一直被键盘遮盖，我设置为150%被的screenHeight
        isChunking: false,                  //stream chatgptapi是否在传输数据中
        lastQuestion: "",                   //保存上一个问题
        lastResponse: ""                    //保存上一个答案
    },
    onLoad: function(options) {

        var s = this;

        /*检测chat gpt 这个api*/
        this.apiCheck();

        //set screen Height
        this.getScreenHeight();

        /*出现loading标致*/
        /*wx.showLoading({
          title: '加载中', // 原生loading提示文本
          mask: true // 遮罩层
        });*/

    },

    //发送信息给服务器尝试获得答复
    apiCheck: function() {
        var s = this;

        var url = getApp().globalData.serverUrl + "checkGPTApi";

        wx.request({
            url: url,
            method: 'POST',
            data: {
              message: '你好'
            },
            header: {
              'content-type': 'application/json' // 根据实际情况设置请求头
            },
            success: function (res) {
                //console.log("apicheck response: " + res.data.message);

                getApp().globalData.isCheckApi = true;


                //当login并且检测了gpt api之后，才隐藏loading的标致
                if(getApp().globalData.isLogin && getApp().globalData.isCheckApi){
                  wx.hideLoading();
                }

                //msgLoad设成false，代表可以继续发请求到服务器
                s.setData({
                    msgLoad: false
                }); 
            },
            fail: function (res) {
              // 请求失败回调
              console.error('Request failed:', res);
            }
        });
    },
    //发送信息
    sendMsg: function(e) {
        var s = this;

        //如何发送的信息为空，return 0
        if (this.data.msg == "") return 0;

        var userInfo = getApp().globalData.userInfo;
        var availableMsg = userInfo.availableMsg;

        //检查用户余额
        if(availableMsg <= 0){
            Toast.fail('余额不足,请充值');
            return 0;
        } 

        //my代表这条信息是用户发的不是gpt回复的
        //msg 就是我发送的请求
        var newMessage= {
            msg: this.data.msg,
            my: true,
            id: 'unique_id_' + (this.data.msgList.length+1)
        }

        //更新msg List
        var updateMsgList = this.data.msgList.concat(newMessage);
        

        var prompt;
        /*如果lastQuestion==""，代表没有上一个提问，是第一次问，也代表没有lastResponse*/
        if(this.data.lastQuestion == ""){
            prompt={
                'question': this.data.msg
            }
        }
        else{
            prompt={
                'lastQuestion': this.data.lastQuestion,
                'lastResponse': this.data.lastResponse,
                'question': this.data.msg
            }         
        }

        //更新msgList
        //更新lastQuestion
        //msgLoad代表拥堵
        //msg就是把请求栏目设置为空
        this.setData({
          lastQuestion: this.data.msg,
          msgList: updateMsgList,
          sentext: "请求中",
          msgLoad: true,
          msg: "",
        }); 

        /*send prompt to server chatgpt api*/
        s.sendRequest(prompt);

    },
    /*实际发生请求到服务器端口*/
    sendRequest: function(prompt){
        var s = this;
        var url = getApp().globalData.serverUrl + 'chatWithChatGPT';


        const requestTask = wx.request({
            url: url,
            responseType: 'text',
            method: 'POST',
            enableChunked: true,            //可以获取流体信息
            data: {message: prompt},
            success: function(res) {

                s.setData({
                    isChunking: false
                })

                //获取msgList的最后一个信息
                var length = s.data.msgList.length;
                var lastResponse = s.data.msgList[length-1];

                //msgLoad设成false，代表可以继续发请求到服务器
                //更新lastResponse
                s.setData({
                    lastResponse: lastResponse.msg,
                    msgLoad: false,
                    sentext: "发送"
                });

                /*完成之后，更新用户的availableMsg*/
                var userInfo = getApp().globalData.userInfo;
                var availableMsg = userInfo.availableMsg - 1;

                userInfo.availableMsg = availableMsg;

                //更新用户余额
                getApp().globalData.userInfo = userInfo;
                /*更新database数据*/
                getApp().updateUserInfo(userInfo);
            },
            fail: error => {}
        })
        /*当流体信息进来就会出发*/
        requestTask.onChunkReceived(function(response) {
            /*arrayBuffer变成string*/
            const arrayBuffer = response.data;
            const uint8Array = new Uint8Array(arrayBuffer);
            var encodedString = String.fromCharCode.apply(null, uint8Array);
            var message = decodeURIComponent(escape((encodedString)));//没有这一步中文会乱码

            var newMessage= {
                msg: message,
                my: false,
                id: '',
            };

            var uniqueId = ''

            var updateMsgList;
            var length = s.data.msgList.length;

            /*isCHunking说明还在不断接收流体信息*/
            if(s.data.isChunking){
                uniqueId = 'unique_id_' + s.data.msgList.length;
                updateMsgList = s.data.msgList;
                updateMsgList[length-1].msg += message;
            }
            /*第一个流体信息*/
            else{
                s.setData({
                    isChunking: true
                })

                uniqueId = 'unique_id_' + (s.data.msgList.length+1);
                updateMsgList = s.data.msgList.concat(newMessage);
            }

            newMessage.id = uniqueId;

            s.setData({
                msgList: updateMsgList,
            }); 

        })
    },
    //实时更新用户输入到msg
    handleInput: function (e) {
        // 当用户输入时触发，将输入的值存储在data中的userInput变量中
        this.setData({
          msg: e.detail.value
        });
    },
    // 在JS文件中获取content高度
    getScreenHeight: function(){
        var s = this;
        wx.getSystemInfo({
          success: function (res) {
            /*input 我设置了大小为110rpx*/
            var inputHeight = 110;//rpx
            var windowWidth = res.windowWidth;
            inputHeight = inputHeight * windowWidth / 750; // convert rpx to px

            var contentHeight = res.windowHeight - inputHeight;

            // 将样式设置到元素上
            s.setData({
              contentHeight: contentHeight
            });
          }
        });
    }
})