const app = getApp();

Page({
  data: {
    serverUrl: "",
  },

  onShow() {
    this.setData({ serverUrl: app.globalData.serverUrl });
  },

  onInput(e) {
    this.setData({ serverUrl: e.detail.value });
  },

  onSave() {
    app.setServerUrl(this.data.serverUrl.trim());
    wx.showToast({ title: "已保存", icon: "success" });
    setTimeout(() => wx.navigateBack(), 500);
  },
});
