# ai-media-recorder
This is a tool for media recorder in html5. If you like it please give me a star, which drive me do better.If you have some interesting ideas, please let me know.

# 使用方式
## 一、 npm 引入
```javascript
npm i ai-media-recorder
```

需要封装的组件

```javascript
import AiMediaRecorder from "ai-media-recorder";
let aiMediaRecorder = new AiMediaRecorder({
  constraints: {
    video: {
      width: 400,
      height: 300
    },
    audio: true
  },
  success: stream => {},
  error: error => {
    console.log(error);
  }
});
```

# 属性支持

```javascript
constraints 同原生的api
```

```javascript
success 获取多媒体权限成功
```

```javascript
error 获取多媒体权限失败
```

# 接口支持

```javascript
start  开始录音
stop  停止录音
download  下载音频文件
getBlob   获取base64 语音编码
getBuffer 获取二进制语音文件
```

# 二、 静态方式引用
参考 example/index.html
