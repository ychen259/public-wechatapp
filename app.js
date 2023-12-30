App({
  globalData: {
    userInfo: null,
    headerHeight: null,
    serverUrl: "https://xiaolailai.online/",
    //serverUrl: "http://xiaolailai.online/",
    isLogin: false,
    isCheckApi: false
  },

  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    /*出现loading标致*/
    wx.showLoading({
      title: '加载中', // 原生loading提示文本
      mask: true // 遮罩层
    });

    // 登录
    var s = this;
    wx.login({
      success: res => {
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
        if (res.code) {
          var jscode = res.code;

          // 将 code 发送给服务器，服务器获取用户的 OpenID
          var url = s.globalData.serverUrl + "sendCodeToService";

          wx.request({
            url: url,
            method: 'POST',
            data: {
              code: jscode
            },
            header: {
              'content-type': 'application/json' // 根据实际情况设置请求头
            },
            success: function (res) {
              //更新userInfo数据,这个多了openid在里面
              //例子 {availableMsg: 5, avatarUrl: "wxfile://t.jpg", nickname: "Joe ", openid: "xx"}
              var userInfo = res.data.userInfo;
              s.globalData.userInfo = userInfo;

              s.globalData.isLogin = true;

              //当login并且检测了gpt api之后，才隐藏loading的标致
              if(s.globalData.isLogin && s.globalData.isCheckApi){
                  wx.hideLoading();
              }
            },
            fail: function (res) {
              // 请求失败回调
              console.error('Request failed:', res);
            }
          });
          console.log("登陆成功");
        } else {
          console.log('登录失败' + res.errMsg);
        }
      },
      fail: res =>{
        console.log("fail");
      }
    })
  },
  //更新database里面的数据
  updateUserInfo: function(userInfo){
      var url = this.globalData.serverUrl + "updateUserInfo";

      wx.request({
          url: url,
          method: 'POST',
          data: {
            userInfo: userInfo
          },
          header: {
            'content-type': 'application/json' // 根据实际情况设置请求头
          },
          success: function (res) {
              console.log(res.data.message);
          },
          fail: function (res) {
          }
      });
  },

})
