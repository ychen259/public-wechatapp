const serverUrl = 'wss://xiaolailai.online/';

Page({
  data: {
    avatarUrl: null,
    nickname: null,
  },
  onLoad: function () {
    var s = this;
    this.setData({
      avatarUrl: getApp().globalData.userInfo.avatarUrl,
      nickname:getApp().globalData.userInfo.nickname
    });
  },

  /*实时保存头像*/
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail 
    this.setData({
      avatarUrl: avatarUrl
    });
  },
  /*需要真机检测才能触发这个方程，模拟器不行*/
  /*实时保存昵称*/
  handleNickname(e){
    this.setData({
      nickname: e.detail.value
    });
    console.log("nickname: " + this.data.nickname);
  },
  /*点击保存后，就更新用户信息*/
  handleInfoUpdate(){
    var s = this;
    var userInfo = getApp().globalData.userInfo;
    userInfo.avatarUrl = this.data.avatarUrl;
    userInfo.nickname = this.data.nickname;

    getApp().globalData.userInfo = userInfo;

    /*更新数据库信息*/
    getApp().updateUserInfo(userInfo); 
  }

})