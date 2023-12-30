Page({
  data: {
    contentHeight:"",
    headerHeight:"",
    userInfo: null,
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
  /*从其他页面跳转回来的时候就更新用户信息*/
  onShow(){
    this.getUserInfo();
  },
  getContentHeight: function(){
    var s = this;

    wx.getSystemInfo({
      success: function (res) {
        const windowHeight = res.windowHeight;

        /*把名字头像那个区域，设置为1/4的可用屏幕*/
        const headerHeight = 0.25*windowHeight;

        const contentHeight = windowHeight - headerHeight;

        // 动态设置样式
        const contentHeightStyle = `height: ${contentHeight}px;`;
        const headerHeightStyle = `height: ${headerHeight}px;`;
        // 将样式设置到元素上
        s.setData({
          contentHeight: contentHeightStyle,
          headerHeight:headerHeightStyle
        });

        getApp().globalData.headerHeight = headerHeight;
      }
    });
  }
});

// 在每个子页面（dailyTask.js、tutorial.js、feedback.js、aboutUs.js、contactUs.js）中，你可以编写对应的逻辑。
