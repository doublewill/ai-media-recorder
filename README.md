# ai-media-recorder
a tool for media recorder in html5


# 使用方式

import AiMediaRecorder from "ai-media-recorder";

let aiMediaRecorder = new AiMediaRecorder({

  constraints: {
  
    video: {
    
      width: 400,
      
      height: 300
      
    },
    audio: true
  },
  
  success: stream => {

  },
  
  error: error => {
  
    console.log(error);
    
  }
  
});


# 属性支持

constraints 同原生的api

success 获取多媒体权限成功

error 获取多媒体权限失败


# 接口支持

start  开始录音

stop  停止录音

download  下载音频文件

getBlob   获取base64 语音编码

getBuffer 获取二进制语音文件



