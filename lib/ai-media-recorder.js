class AudioData {
  constructor(config) {
    this.size = 0; //录音文件长度
    this.buffer = []; //录音缓存
    this.config = config;
    this.inputSampleRate = config.sampleRate || 16000; //输入采样率
    this.inputSampleBits = 16; //输入采样数位 8, 16
    this.outputSampleRate = config.sampleRate || 16000; //输出采样率
    this.outputSampleBits = config.sampleBits || 16; //输出采样数位 8, 16
  }
  input(data) {
    this.buffer.push(new Float32Array(data)); //Float32Array
    this.size += data.length;
  }
  getRawData() {
    //合并压缩
    let data = new Float32Array(this.size);
    let offset = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      data.set(this.buffer[i], offset);
      offset += this.buffer[i].length;
    }
    //压缩
    let getRawDataion = parseInt(this.inputSampleRate / this.outputSampleRate);
    let length = data.length / getRawDataion;
    let result = new Float32Array(length);
    let index = 0,
      j = 0;
    while (index < length) {
      result[index] = data[j];
      j += getRawDataion;
      index++;
    }
    return result;
  }
  getFullWavData() {
    let sampleRate = Math.min(this.inputSampleRate, this.outputSampleRate);
    let sampleBits = Math.min(this.inputSampleBits, this.outputSampleBits);
    let bytes = this.getRawData();
    let dataLength = bytes.length * (sampleBits / 8);
    let buffer = new ArrayBuffer(44 + dataLength);
    let data = new DataView(buffer);
    let config = this.config;
    let offset = 0;
    let writeString = function(str) {
      for (let i = 0; i < str.length; i++) {
        data.setUint8(offset + i, str.charCodeAt(i));
      }
    };
    // 资源交换文件标识符
    writeString("RIFF");
    offset += 4;
    // 下个地址开始到文件尾总字节数,即文件大小-8
    data.setUint32(offset, 36 + dataLength, true);
    offset += 4;
    // WAV文件标志
    writeString("WAVE");
    offset += 4;
    // 波形格式标志
    writeString("fmt ");
    offset += 4;
    // 过滤字节,一般为 0x10 = 16
    data.setUint32(offset, 16, true);
    offset += 4;
    // 格式类别 (PCM形式采样数据)
    data.setUint16(offset, 1, true);
    offset += 2;
    // 通道数
    data.setUint16(offset, config.channelCount, true);
    offset += 2;
    // 采样率,每秒样本数,表示每个通道的播放速度
    data.setUint32(offset, sampleRate, true);
    offset += 4;
    // 波形数据传输率 (每秒平均字节数) 单声道×每秒数据位数×每样本数据位/8
    data.setUint32(
      offset,
      config.channelCount * sampleRate * (sampleBits / 8),
      true
    );
    offset += 4;
    // 快数据调整数 采样一次占用字节数 单声道×每样本的数据位数/8
    data.setUint16(offset, config.channelCount * (sampleBits / 8), true);
    offset += 2;
    // 每样本数据位数
    data.setUint16(offset, sampleBits, true);
    offset += 2;
    // 数据标识符
    writeString("data");
    offset += 4;
    // 采样数据总数,即数据总大小-44
    data.setUint32(offset, dataLength, true);
    offset += 4;
    // 写入采样数据
    data = this.compress(sampleBits, offset, bytes, data);
    return new Blob([data], { type: "audio/wav" });
  }
  closeContext() {
    context.close(); //关闭AudioContext否则录音多次会报错。
  }
  getPureWavData(offset) {
    let sampleBits = Math.min(this.inputSampleBits, this.outputSampleBits);
    let bytes = this.getRawData();
    let dataLength = bytes.length * (sampleBits / 8);
    let buffer = new ArrayBuffer(dataLength);
    let data = new DataView(buffer);
    data = this.compress(sampleBits, offset, bytes, data);
    return new Blob([data], { type: "audio/wav" });
  }
  compress(sampleBits, offset, iBytes, oData) {
    if (sampleBits === 8) {
      for (let i = 0; i < iBytes.length; i++, offset++) {
        let s = Math.max(-1, Math.min(1, iBytes[i]));
        let val = s < 0 ? s * 0x8000 : s * 0x7fff;
        val = parseInt(255 / (65535 / (val + 32768)));
        oData.setInt8(offset, val, true);
      }
    } else {
      for (let i = 0; i < iBytes.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, iBytes[i]));
        oData.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      }
    }
    return oData;
  }
}

class AiMediaRecorder {
  constructor(config) {
    this.config = config;
    this.context = null;
    this.recorder = null;
    this.buffer = [];
    this.audioData = null;
    this.polyfillUserMedia();
    this.checkTypeSupported();
  }

  polyfillUserMedia() {
    if (!navigator.mediaDevices) {
      navigator.mediaDevices = {};
    }

    if (!navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia = function(constraints) {
        let getUserMedia =
          navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

        if (!getUserMedia) {
          return Promise.reject(
            new Error("getUserMedia is not implemented in this browser")
          );
        }
        return new Promise(function(resolve, reject) {
          getUserMedia.call(navigator, constraints, resolve, reject);
        });
      };
    }
  }

  checkTypeSupported() {
    let types = [
      "video/webm",
      "audio/webm",
      "video/webm;codecs=vp8",
      "video/webm;codecs=daala",
      "video/webm;codecs=h264",
      "audio/webm;codecs=opus",
      "video/mpeg"
    ];

    for (let i in types) {
      console.log(
        "Is " +
          types[i] +
          " supported? " +
          (MediaRecorder.isTypeSupported(types[i]) ? "Maybe!" : "Nope :(")
      );
    }
  }

  getAllBuffer() {
    return this.buffer;
  }
  start() {
    this.context = new (window.AudioContext || window.webkitAudioContext)();
    let context = this.context;
    this.recorder = context.createScriptProcessor(4096, 1, 1);

    this.audioData = new AudioData({
      channelCount: 1,
      sampleRate: context.sampleRate
    });

    this.recorder.onaudioprocess = e => {
      let lData = e.inputBuffer.getChannelData(0);
      this.buffer.push(lData);
      this.config.updateBuffer(lData);
    };

    navigator.mediaDevices
      .getUserMedia(this.config.constraints)
      .then(stream => {
        let mediaRecorder = new MediaRecorder(stream, {
          audioBitsPerSecond: 16000,
          videoBitsPerSecond: 256000,
          mimeType: "video/webm;codecs=vp9"
        });

        mediaRecorder.start(5000);

        const mediaStream = this.context.createMediaStreamSource(stream);

        mediaStream.connect(this.recorder);
        this.recorder.connect(this.context.destination);

        mediaRecorder.onstop = function(e) {
          // videoBlob = new Blob(chunks, { type: "video/mp4" });
          // chunks = [];
        };

        mediaRecorder.ondataavailable = function(e) {
          // chunks.push(e.data);
        };

        let videoEl = this.config.videoEl;
        videoEl.srcObject = stream;

        videoEl.onloadedmetadata = function() {
          videoEl.play();
          videoEl.muted = true;
        };
      })
      .catch(error => {
        console.log(error.name + ": " + error.message);
      });
  }
}

export default AiMediaRecorder;
