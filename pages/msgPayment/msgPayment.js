import Toast from '@vant/weapp/toast/toast';

Page({
    data: {
        contentHeight:"",
        userInfo: null,
        selectedIndex: 0,
        headerHeight:"",
        contentList: [
                        {"msgNum": 30, "price": 9.9, "regularPrice": 20},
                        {"msgNum": 300, "price": 39.9, "regularPrice": 200},
                        {"msgNum": 600, "price": 59.9, "regularPrice": 400},
                        {"msgNum": 1350, "price": 99.9, "regularPrice": 1000}
                        /*{"msgNum": 30, "price": 0.01, "regularPrice": 20},
                        {"msgNum": 300, "price": 0.01, "regularPrice": 200},
                        {"msgNum": 600, "price": 0.01, "regularPrice": 400},
                        {"msgNum": 1350, "price": 0.01, "regularPrice": 1000}*/
                    ]

    },
    onLoad(options){
        var s = this;
        this.getContentHeight();
        this.getUserInfo();
    },
    getUserInfo(){
        this.setData({
            userInfo: getApp().globalData.userInfo
        })
    },
    getContentHeight: function(){
        var s = this;

        wx.getSystemInfo({
          success: function (res) {
            const windowHeight = res.windowHeight;
            const headerHeight = getApp().globalData.headerHeight;

            const contentHeight = windowHeight - headerHeight;

            // 动态设置样式
            const contentHeightStyle = `height: ${contentHeight}px;`;
            const headerHeightStyle = `height: ${headerHeight}px;`;
            // 将样式设置到元素上
            s.setData({
              contentHeight: contentHeightStyle,
              headerHeight:headerHeightStyle
            });
          }
        });
    },
    /*让选择的图标有border*/
    selectItem: function(e) {
        var index = e.target.dataset.index;

      this.setData({
        selectedIndex: index
      });
      // Add your additional logic here when an item is selected
    },
    /*提交订单*/
    submitPayment:function(){
        var s = this;
        var contentList = this.data.contentList;
        var selectedIndex = this.data.selectedIndex;

        var openid = this.data.userInfo.openid;
        var price = contentList[selectedIndex].price;

        var data = {
            'openid': openid,
            'price': price
        }

        s.paymentRequest(data);

    },
    /*发送订单到服务器*/
    paymentRequest: function(data){
        var s = this;
        var url = getApp().globalData.serverUrl + 'sendPaymentRequest';
        wx.request({
          url: url,
          method: 'POST',
          data: {
            price: data.price,
            openid: data.openid,
          },
          header: {
            'content-type': 'application/json' // 根据实际情况设置请求头
          },
          /*成功之后返回timeStamp，nonceStr，package，signType，paySign信息*/
          success: function (response) {
                var contentList = s.data.contentList;
                var selectedIndex = s.data.selectedIndex;

                var result = response.data.result.result;
                
                wx.requestPayment({
                  'timeStamp': result.timeStamp,
                  'nonceStr': result.nonceStr,
                  'package': result.package,
                  'signType': result.signType,
                  'paySign': result.paySign,

                  'success': function (res) {
                        Toast.success('成功兑换'+contentList[selectedIndex].msgNum+'条对话');

                        var userInfo = getApp().globalData.userInfo;
                        userInfo.availableMsg = userInfo.availableMsg + contentList[selectedIndex].msgNum;
                        
                        getApp().globalData.userInfo = userInfo;

                        s.getUserInfo();

                        getApp().updateUserInfo(userInfo);
                  },
                  'fail': function (res) {
                    Toast.fail('充值失败');
                  },
                  'complete': function (res) {
         
                  }
                })
          },
          fail: function (res) {
            // 请求失败回调
            console.error('Request failed:', res);
          }
        });
      }
});

// 在每个子页面（dailyTask.js、tutorial.js、feedback.js、aboutUs.js、contactUs.js）中，你可以编写对应的逻辑。
