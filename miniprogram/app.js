App({
  globalData: {
    serverUrl: "",
  },

  onLaunch() {
    const saved = wx.getStorageSync("serverUrl");
    if (saved) this.globalData.serverUrl = saved;
  },

  setServerUrl(url) {
    const trimmed = (url || "").replace(/\/$/, "");
    this.globalData.serverUrl = trimmed;
    wx.setStorageSync("serverUrl", trimmed);
  },
});
