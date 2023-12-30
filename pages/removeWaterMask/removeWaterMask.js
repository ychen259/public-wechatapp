import Toast from '@vant/weapp/toast/toast';

Page({
  data: {
    imageUrl: '',             //path for selected image
    context: null,            //record context of canvas context
    touchPoints: [],          // Array to store touched points in canvas
    canvasHeight: 0,         //height of canvas
    canvasWidth: 0,          //width of canvas
    isChooseImage: false,      //是否选择了图片
    containerHeight: 0,       //设置container的min-height高度，确保headerHight+containerHeight占满整个画面
    containerWidth: 0,         //设置container宽度满屏 但是这个单位px
    headerHeight: 100         //100px  headerHeight+containerHeight占满整个画面
  },
  imageBase64: "",            //原始图片的数据形式
  maskBase64: "",             //mask的数据形式
  num:0,                      //number of times去修改图片，这个为了修改保存路径，更新在页面上的现实图片f

  onLoad(){
    /*get default setting*/
    this.getHeaderAndContainerHeight();
  },
  /*上传图片*/
  chooseImage: function () {
    var s = this;
    // 选择图片并上传
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const imageUrl = res.tempFilePaths[0];

        wx.getImageInfo({
         src: imageUrl,
         success: function (res) {
            /*获取图片原始高度和宽度*/
            var w = res.width;
            var h = res.height;

            const systemInfo = wx.getSystemInfoSync();

            const imageAspectRatio = w / h;
            const containerAspectRatio = s.data.containerWidth / s.data.containerHeight;

            var canvasWidth;
            var canvasHeight;
            /*当图片宽度沾满750rpx的时候，高度还没有高到可以向下拉动*/
            /*把canvas宽度设为750rpx,高度根据图片比例设定*/
            if(imageAspectRatio >= containerAspectRatio){
              /*设置canvas高度和宽度*/
              canvasWidth = systemInfo.windowWidth;
              canvasHeight = Math.round(canvasWidth / imageAspectRatio);
            }
            /*当图片宽度还没沾满750rpx的时候，高度高到可以向下拉动*/
            /*把高度设定为container高度，宽度根据图片比例设定*/
            else{
              canvasHeight = s.data.containerHeight;
              canvasWidth = Math.round(imageAspectRatio * canvasHeight);
            }

            const context = wx.createCanvasContext('mainCanvas', s);

            // Load the uploaded image to the canvas
            context.drawImage(imageUrl, 0, 0, canvasWidth, canvasHeight);

            //draw() == draw(false) 意思是不接着上一次绘画
            context.draw(true, () =>{
              /*利用canvas来把图片尺寸改变成能放进canvas的尺寸，并且生成他的路径保存下来*/
              wx.canvasToTempFilePath({
                canvasId: 'mainCanvas',
                success: (res) => {
                  const scaledFilePath = res.tempFilePath;

                  console.log("img path: " + scaledFilePath)
                  /*保存改变好图片大小的路径*/
                  s.setData({
                    imageUrl: scaledFilePath, 
                  });


                  /*把图片转化为base64二进制的形式，方便我上传图片到服务器*/
                  wx.getFileSystemManager().readFile({
                    filePath: scaledFilePath,
                    encoding: 'base64',
                    success: (res) => {
                      const base64Data = res.data;
                      s.imageBase64 = base64Data;
                    },
                    fail: (err) => {
                      console.error('Read file failed', err);
                    }
                  });

                },
                fail: (error) => {
                  console.error('canvasToTempFilePath 失败', error);
                },
              });
            });

            /*记录canvas高度宽度，和context的初始内容并且把flag isChooseImage设置为true*/
            s.setData({
              canvasHeight: canvasHeight,
              canvasWidth: canvasWidth,
              context:  context,
              isChooseImage: true
            });
          }
        })

      },
      fail: (err) => {
        console.error('选择图片失败', err);
      },
    });
  },

  /*手指开始触碰*/
  touchStart: function (e) {
    // 获取触摸点坐标
    const x = e.touches[0].x;
    const y = e.touches[0].y;

    // 添加触摸点到数组
    var touchPoints = this.data.touchPoints;

    this.setData({
      touchPoints: touchPoints.concat({ x, y })
    })

    // 开始绘制路径
    this.drawTouchedPoint(x, y);
  },
  /*手指开始触碰并且移动*/
  touchMove: function (e) {

      // 获取触摸点坐标
      const x = e.touches[0].x;
      const y = e.touches[0].y;

      // 添加触摸点到数组
      var touchPoints = this.data.touchPoints;

      this.setData({
        touchPoints: touchPoints.concat({ x, y })
      })

      // 开始绘制路径
      this.drawTouchedPoint(x, y);
  },

  /*把触碰过的点，以半径的形式画出园形成路径*/
  drawTouchedPoint: function (x, y) {
    var context = this.data.context;

    context.beginPath();

    context.arc(x, y, 15, 0, 2 * Math.PI); //画出radius startAngle 0 end Angel为2Pi的园
    // 设置填充颜色为紫色，透明度为 0.5
    context.fillStyle = 'rgba(128, 0, 128, 0.5)';
    context.fill();
    context.draw(true);
  },

  /*处理图片*/
  processImage: function () {
    var s = this;

    /*当用户没有选择上传图片时候，不处理*/
    if(s.data.isChooseImage == false) {
      Toast.fail('请上传图片');
      return
    }

    /*设置临时Canvas,来画出mask的路径，不能使用mainCanvas是因为mainCanvas里面有路径加图片*/
    var tempContext = wx.createCanvasContext('maskCanvas', s);

    var touchPoints = this.data.touchPoints;

    var length = touchPoints.length;

    /*如果用户没有画出消除路径就不处理*/
    if(length == 0){
      Toast.fail('请涂抹需要消除的区域');
      return
    }

    /*展示loading的图标*/
    wx.showLoading({
      title: '处理图片中', // 原生loading提示文本
      mask: true // 遮罩层
    });

    /*计算出mask的路径，并且画在maskCanvas上面*/
    for(var i = 0; i < length; i++){ 
      var x = touchPoints[i].x;
      var y = touchPoints[i].y;
      tempContext.arc(x, y, 15, 0, 2 * Math.PI); //画出radius startAngle 0 end Angel为2Pi的园
      tempContext.fillStyle = 'white'; // Set fill color to black
      tempContext.fill();
      tempContext.draw(true);
    }

    // Save the canvas content to a temporary file
    wx.canvasToTempFilePath({
      canvasId: 'maskCanvas',
      success: (res) => {
        const maskPath = res.tempFilePath;
        console.log(maskPath)

        /*把mask的图片转化为base64二进制格式发送给服务器*/
        wx.getFileSystemManager().readFile({
          filePath: maskPath,
          encoding: 'base64',
          success: (res) => {
            const base64Data = res.data;
            s.maskBase64 = base64Data;

            s.uploadFileToServer(s.imageBase64,s.maskBase64);
          },
          fail: (err) => {
            console.error('Read file failed', err);
          }
        });
      },
      fail: (error) => {
        console.error('Canvas to Temp File Error:', error);
      },
    }, s);
  },

  /*POST request去到后端服务器*/
  uploadFileToServer(imageBase64, maskBase64){

    var s = this;
    var url = getApp().globalData.serverUrl + 'inPaintImage';

    /*发送POST request到服务器，并且发送image和mask的二进制数据*/
    wx.request({
        url: url,
        method: 'POST',
        data: {
          image: imageBase64,
          mask: maskBase64
        },
        header: {
          'content-type': 'application/json' // 根据实际情况设置请求头
        },
        success: function (res) {
          /*返回结果后就隐藏loading图标*/
          wx.hideLoading();

          /*获取处理好的base64二进制数据*/
          var file_data = res.data.file_data;

          // Convert Base64 string to ArrayBuffer
          const arrayBuffer = wx.base64ToArrayBuffer(file_data);

          /*如果s.num大于0代表有保存过文件，就要删除之前的临时文件，反正内存不足问题*/
          if(s.num > 0){
            // Generate a temporary file path
            const tempFilePath = `${wx.env.USER_DATA_PATH}/temp_image` + (s.num-1) + `.png`;

              wx.getFileSystemManager().unlink({
                filePath: tempFilePath,
                success: function (res) {
                  console.log('文件删除成功', tempFilePath);
                },
              });
          }

          //Generate a temporary file path
          const tempFilePath = `${wx.env.USER_DATA_PATH}/temp_image` + s.num + `.png`;

          // Write data to the temporary file
          wx.getFileSystemManager().writeFile({
            filePath: tempFilePath,
            data: arrayBuffer,
            encoding: 'binary',
            success: function (res) {

              /*把imageUrl改成处理好的文件，touchPoints更新为[]*/
              s.setData({
                imageUrl: tempFilePath,
                touchPoints: [],
              });
              /*更新图片二进制数据到最新的图片数据*/
              s.imageBase64 = file_data;

              /*更新num,以便于下次创建tempFilePath*/
              s.num++;

              /*把mainCanvas改成最新的图片*/
              var context = s.data.context;
              context.drawImage(tempFilePath, 0, 0, s.data.canvasWidth, s.data.canvasHeight);
              context.draw();
              
              /*清空maskCanvas内容*/
              var tempContext = wx.createCanvasContext('Canvas', s);
              tempContext.draw(false)
                  
              // Now, tempFilePath contains the image path
              console.log('Finish Image path:', tempFilePath);
            },
            fail: function (res) {
              console.error('Write file failed:', res);
            }
          });

        },
        fail: function (res) {
          // 请求失败回调
          wx.hideLoading();
          console.error('Request failed:', res);
        }
    });
  },

  /*让用户下载处理好的文件*/
  downloadFile: function () {
    // 文件下载地址
    var s = this;
    var url = s.data.imageUrl; // 替换为你的文件地址

    /*当用户没有选择上传图片时候，不处理*/
    if(s.data.isChooseImage == false) {
      Toast.fail('请上传图片');
      return
    }

    /*把图片保存到用户手机*/
    wx.saveImageToPhotosAlbum({
      filePath: url,
      success: () => {
        Toast.success('保存成功！');

        /*重新把设置改为原始状态*/
        s.setData({
          imageUrl: '',             //path for selected image
          context: null,            //record context of canvas context
          touchPoints: [],          // Array to store touched points in canvas
          canvasHeight: "",         //height of canvas
          canvasWidth: "",          //width of canvas
          isChooseImage: false,      //是否选择了图片
        });

        /*删除掉临时文件*/
        if(s.num > 0){
          // Generate a temporary file path
          const tempFilePath = `${wx.env.USER_DATA_PATH}/temp_image` + (s.num-1) + `.png`;

            wx.getFileSystemManager().unlink({
              filePath: tempFilePath,
              success: function (res) {
              },
            });
        }
        s.imageBase64 = "";            
        s.maskBase64 = "";             
        s.num = 0;
      },
      fail: (error) => {
        Toast.fail('保存失败');

      }
    });
  },
  /*计算出header和container的高度*/
  getHeaderAndContainerHeight: function(){
    var s = this;
    //set headerHeight to 100rpx
    var headerHeight = s.data.headerHeight;

    //grid-item-padding is 16px;
    var gridPadding = 16;

    //上下padding就是32px
    var totalPadding = 2 * gridPadding;

    //container的border is 1px;
    var containerBorder = 1;

    //上下border就是2px
    var totalBorder = 2 * containerBorder;

    wx.getSystemInfo({
      success: function (res) {
        /*input 我设置了大小为110rpx*/
        var inputHeight = 110;//rpx
        var windowWidth = res.windowWidth;
        headerHeight = headerHeight * windowWidth / 750; // convert rpx to px

        var containerHeight = res.windowHeight - headerHeight - totalPadding - totalBorder;

        // 将样式设置到元素上
        s.setData({
          containerWidth: windowWidth,
          headerHeight: headerHeight,
          containerHeight: containerHeight
        });
      }
    });
  },


});
