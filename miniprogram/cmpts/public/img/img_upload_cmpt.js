const pageHelper = require('../../../helper/page_helper.js');

Component({
        options: {
                addGlobalClass: true
        },

        properties: {
                imgList: {
                        type: Array,
                        value: []

                },
                title: {
                        type: String,
                        value: '签字',
                },
                must: { //是否必填
                        type: Boolean,
                        value: true,
                }
        },

        data: {
                isDrawing: false,
                hasDrawn: false
        },

        lifetimes: {
                ready: function () {
                        this._ctx = wx.createCanvasContext('signCanvas', this);
                        this._ctx.setStrokeStyle('#333333');
                        this._ctx.setLineWidth(4);
                        this._ctx.setLineCap('round');
                        this._ctx.setLineJoin('round');

                        this._bounding = { left: 0, top: 0 };
                        this._canvasSize = { width: 0, height: 0 };
                        const query = this.createSelectorQuery().in(this);
                        query.select('#signCanvas').boundingClientRect((rect) => {
                                if (rect) {
                                        this._bounding = { left: rect.left, top: rect.top };
                                        this._canvasSize = { width: rect.width, height: rect.height };
                                }
                        }).exec();
                },
                detached: function () {
                        this._ctx = null;
                },
        },

        methods: {
                _getPoint(e) {
                        const touch = e.changedTouches[0];
                        const x = touch.x || touch.pageX;
                        const y = touch.y || touch.pageY;
                        const bounding = this._bounding || { left: 0, top: 0 };
                        return {
                                x: x - bounding.left,
                                y: y - bounding.top
                        };
                },

                bindStartSign: function (e) {
                        if (!this._ctx) return;
                        const point = this._getPoint(e);
                        this._ctx.beginPath();
                        this._ctx.moveTo(point.x, point.y);
                        this.setData({
                                isDrawing: true,
                                hasDrawn: true
                        });
                },

                bindMoveSign: function (e) {
                        if (!this.data.isDrawing || !this._ctx) return;
                        const point = this._getPoint(e);
                        this._ctx.lineTo(point.x, point.y);
                        this._ctx.stroke();
                        this._ctx.draw(true);
                },

                bindEndSign: function () {
                        this.setData({
                                isDrawing: false
                        });
                },

                bindClearSign: function () {
                        if (!this._ctx) return;
                        const canvasSize = this._canvasSize || { width: 0, height: 0 };
                        const width = canvasSize.width;
                        const height = canvasSize.height;
                        this._ctx.clearRect(0, 0, width, height);
                        this._ctx.draw();
                        this.setData({
                                hasDrawn: false,
                                imgList: []
                        });
                        this.triggerEvent('upload', this.data.imgList);
                },

                bindSaveSign: function () {
                        if (!this.data.hasDrawn) {
                                return pageHelper.showNoneToast('请先完成签字');
                        }
                        wx.canvasToTempFilePath({
                                canvasId: 'signCanvas',
                                success: (res) => {
                                        this.setData({
                                                imgList: [res.tempFilePath]
                                        });
                                        this.triggerEvent('upload', this.data.imgList);
                                        pageHelper.showSuccToast('签字已保存');
                                },
                                fail: () => {
                                        pageHelper.showNoneToast('签字保存失败，请重试');
                                }
                        }, this);
                },

                bindPreviewImgTap: function () {
                        if (!this.data.imgList.length) return;
                        wx.previewImage({
                                urls: this.data.imgList,
                                current: this.data.imgList[0]
                        });
                }
        }
});
