const app = getApp();

Page({
  data: {
    serverUrl: "",
    code: "",
    codeInput: "",
    selected: [],
    uploading: false,
    errorText: "",
  },

  onShow() {
    this.setData({ serverUrl: app.globalData.serverUrl, errorText: "" });
  },

  goSettings() {
    wx.navigateTo({ url: "/pages/settings/settings" });
  },

  onCodeInput(e) {
    this.setData({ codeInput: e.detail.value });
  },

  requireServer() {
    if (!this.data.serverUrl) {
      this.setData({ errorText: "请先设置服务器地址" });
      return false;
    }
    return true;
  },

  newBatch() {
    if (!this.requireServer()) return;
    wx.request({
      url: `${this.data.serverUrl}/api/batches`,
      method: "POST",
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          this.setData({ code: res.data.code, errorText: "" });
        } else {
          this.setData({ errorText: "新建批次失败：" + JSON.stringify(res.data) });
        }
      },
      fail: (err) => this.setData({ errorText: "新建批次失败：" + err.errMsg }),
    });
  },

  joinBatch() {
    const code = (this.data.codeInput || "").trim().toUpperCase();
    if (!code) return;
    this.setData({ code, codeInput: "", errorText: "" });
  },

  // 从微信聊天记录（含群聊）里选图片/文件——这是从"老师发在群里的图片/PDF"
  // 导入的核心入口，不依赖任何微信未开放的自动抓取接口。
  chooseFromChat() {
    wx.chooseMessageFile({
      count: 20,
      type: "all",
      success: (res) => {
        const items = res.tempFiles.map((f, i) => ({
          path: f.path,
          name: f.name || `文件_${Date.now()}_${i}`,
          type: f.type === "image" ? "image" : "file",
          uploaded: false,
          status: "",
          statusText: "",
        }));
        this.setData({ selected: this.data.selected.concat(items), errorText: "" });
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.indexOf("cancel") >= 0) return;
        this.setData({ errorText: "选择聊天记录文件失败：" + err.errMsg });
      },
    });
  },

  chooseFromAlbum() {
    wx.chooseMedia({
      count: 20,
      mediaType: ["image"],
      sourceType: ["album"],
      success: (res) => {
        const items = res.tempFiles.map((f, i) => ({
          path: f.tempFilePath,
          name: `图片_${Date.now()}_${i}.jpg`,
          type: "image",
          uploaded: false,
          status: "",
          statusText: "",
        }));
        this.setData({ selected: this.data.selected.concat(items), errorText: "" });
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.indexOf("cancel") >= 0) return;
        this.setData({ errorText: "选择相册图片失败：" + err.errMsg });
      },
    });
  },

  removeSelected(e) {
    const index = e.currentTarget.dataset.index;
    const selected = this.data.selected.slice();
    selected.splice(index, 1);
    this.setData({ selected });
  },

  uploadAll() {
    if (!this.requireServer()) return;
    if (!this.data.code) {
      this.setData({ errorText: "请先新建或输入批次码" });
      return;
    }
    const pending = this.data.selected
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !item.uploaded);
    if (pending.length === 0) return;

    this.setData({ uploading: true, errorText: "" });
    this.markStatus(pending.map((p) => p.index), "uploading", "上传中…");

    let remaining = pending.length;
    let hadError = false;

    pending.forEach(({ item, index }) => {
      wx.uploadFile({
        url: `${this.data.serverUrl}/api/batches/${this.data.code}/upload`,
        filePath: item.path,
        name: "files",
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            this.markStatus([index], "done", "已上传", true);
          } else {
            hadError = true;
            this.markStatus([index], "error", "上传失败");
          }
        },
        fail: () => {
          hadError = true;
          this.markStatus([index], "error", "上传失败");
        },
        complete: () => {
          remaining -= 1;
          if (remaining === 0) {
            this.setData({ uploading: false });
            wx.showToast({
              title: hadError ? "部分文件上传失败" : "全部上传成功",
              icon: hadError ? "none" : "success",
            });
          }
        },
      });
    });
  },

  markStatus(indices, status, statusText, uploaded) {
    const selected = this.data.selected.slice();
    indices.forEach((i) => {
      selected[i] = { ...selected[i], status, statusText, uploaded: !!uploaded };
    });
    this.setData({ selected });
  },
});
