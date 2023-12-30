import Toast from '@vant/weapp/toast/toast';

Page({
  data: {
    radio: '', // 选中的反馈类型
    radioTypes: ['建议', '问题', '其他'],
    feedbackContent: '',
    contactInfo: '',
  },
  onLoad: function () {
    var s = this;
  },
  /*保存选项内容*/
  onChange: function (e) {
    this.setData({
      radio: e.detail,
    });
  },
  /*保存内容*/
  onContentInput: function (e) {
    this.setData({
      feedbackContent: e.detail.value,
    });
  },
  /*保存联系方式内容*/
  onContactInput: function (e) {
    this.setData({
      contactInfo: e.detail.value,
    });
  },
  /*提交feedback*/
  submitFeedback: function () {
    var s = this;

    var content={
        "type": s.data.radio,
        "feedbackContent": s.data.feedbackContent,
        "contactInfo": s.data.contactInfo
    }
    
    s.sendFeedback(content);
  },
  /*发送数据到server，然后发送邮件到邮箱*/
  sendFeedback: function(content){
    var url = getApp().globalData.serverUrl + 'feedback';
    wx.request({
      url: url,
      method: 'POST',
      data: {
        type: content.type,
        feedbackContent: content.feedbackContent,
        contactInfo: content.contactInfo
      },
      header: {
        'content-type': 'application/json' // 根据实际情况设置请求头
      },
      success: function (res) {
        Toast.success('感谢你的支持和反馈');

        //等待两秒，等到toast结束（toast设定为两秒）跳转回account页面
        setTimeout(function() {
          wx.switchTab({url: "/pages/account/account"})
        }, 2000); // Same duration as showToast

      },
      fail: function (res) {
        // 请求失败回调
        console.error('Request failed:', res);
      }
    });
  }


});
