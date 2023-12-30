// pages/giftCard/giftCard.js
import Toast from '@vant/weapp/toast/toast';
Page({
    data: {
        cardInfo: null
    },
    onLoad(options) {
    },
    /*实时保存card信息*/
    onCodeInput: function (e) {
        this.setData({
          cardInfo: e.detail.value,
        });
    },
    submitCode(){
        var s = this;

        var cardInfo = this.data.cardInfo;

        s.checkGiftCard(cardInfo);

    },
    /*发送卡密信息到服务器，检测database里面是否有该卡密*/
    checkGiftCard:function(giftCard){
        var s = this;
        var url = getApp().globalData.serverUrl + 'checkGiftCard';
        wx.request({
          url: url,
          method: 'POST',
          data: {
            giftCard: giftCard,
          },
          header: {
            'content-type': 'application/json' // 根据实际情况设置请求头
          },
          success: function (response) {
                if(response.data.message == true){
                    Toast.success('成功兑换30条对话');

                    /*更新客户availableMsg多30条*/
                    var userInfo = getApp().globalData.userInfo;
                    userInfo.availableMsg = userInfo.availableMsg + 30;
                    getApp().globalData.userInfo = userInfo;
                    getApp().updateUserInfo(userInfo);
                }
                else{
                    Toast.fail('错误卡密');
                }
          },
          fail: function (res) {
            // 请求失败回调
            console.error('Request failed:', res);
          }
        });
    }
})