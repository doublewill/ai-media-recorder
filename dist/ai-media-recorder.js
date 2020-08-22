(function (global, factory) {
  typeof exports === "object" && typeof module !== "undefined"
    ? (module.exports = factory())
    : typeof define === "function" && define.amd
    ? define(factory)
    : (global.AIMediaRecorder = factory());
})(this, function () {
  "use strict";

  //  https://developer.mozilla.org/zh-CN/docs/Web/API/MediaDevices/getUserMedia
  function initUserMedia() {
    if (!navigator.mediaDevices) {
      navigator.mediaDevices = {};
    }

    if (!navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia = function (constraints) {
        let getUserMedia =
          navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

        if (!getUserMedia) {
          return Promise.reject(
            new Error("getUserMedia is not implemented in this browser")
          );
        }
        return new Promise(function (resolve, reject) {
          getUserMedia.call(navigator, constraints, resolve, reject);
        });
      };
    }
  }

  function checkTypeSupported() {
    let types = [
      "video/webm",
      "audio/webm",
      "video/webm;codecs=vp8",
      "video/webm;codecs=daala",
      "video/webm;codecs=h264",
      "audio/webm;codecs=opus",
      "video/mpeg",
    ];

    for (var i in types) {
      console.log(
        "Is " +
          types[i] +
          " supported? " +
          (MediaRecorder.isTypeSupported(types[i]) ? "Maybe!" : "Nope :(")
      );
    }
  }

  function AudioDataUtil(option) {
    this.size = 0; //录音文件长度
    this.buffer = []; //录音缓存
    this.inputSampleRate = option.inputSampleRate || 16000; //输入采样率
    this.inputSampleBits = option.inputSampleBits || 16; //输入采样数位 8, 16
    this.outputSampleRate = option.outputSampleRate || 16000; //输出采样率
    this.outputSampleBits = option.sampleBits || 16; //输出采样数位 8, 16
    this.config = option;

    function closeContext() {
      context.close(); //关闭AudioContext否则录音多次会报错。
    }
  }

  AudioDataUtil.prototype.getRawData = function () {
    //合并压缩
    var data = new Float32Array(this.size);
    var offset = 0;
    for (var i = 0; i < this.buffer.length; i++) {
      data.set(this.buffer[i], offset);
      offset += this.buffer[i].length;
    }
    //压缩
    var getRawDataion = parseInt(this.inputSampleRate / this.outputSampleRate);
    var length = data.length / getRawDataion;
    var result = new Float32Array(length);
    var index = 0,
      j = 0;
    while (index < length) {
      result[index] = data[j];
      j += getRawDataion;
      index++;
    }
    return result;
  };

  AudioDataUtil.prototype.getPureWavData = function (offset) {
    var sampleBits = Math.min(this.inputSampleBits, this.outputSampleBits);
    var bytes = this.getRawData();
    var dataLength = bytes.length * (sampleBits / 8);
    var buffer = new ArrayBuffer(dataLength);
    var data = new DataView(buffer);
    data = this.reshapeWavData(sampleBits, offset, bytes, data);
    return new Blob([data], { type: "audio/wav" });
  };
  AudioDataUtil.prototype.reshapeWavData = function (
    sampleBits,
    offset,
    iBytes,
    oData
  ) {
    if (sampleBits === 8) {
      for (var i = 0; i < iBytes.length; i++, offset++) {
        var s = Math.max(-1, Math.min(1, iBytes[i]));
        var val = s < 0 ? s * 0x8000 : s * 0x7fff;
        val = parseInt(255 / (65535 / (val + 32768)));
        oData.setInt8(offset, val, true);
      }
    } else {
      for (var i = 0; i < iBytes.length; i++, offset += 2) {
        var s = Math.max(-1, Math.min(1, iBytes[i]));
        oData.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      }
    }
    return oData;
  };

  AudioDataUtil.prototype.input = function (data) {
    this.buffer.push(new Float32Array(data)); //Float32Array
    this.size += data.length;
  };

  AudioDataUtil.prototype.getFullWavData = function () {
    let config = this.config;
    var sampleRate = Math.min(this.inputSampleRate, this.outputSampleRate);
    var sampleBits = Math.min(this.inputSampleBits, this.outputSampleBits);
    var bytes = this.getRawData();
    var dataLength = bytes.length * (sampleBits / 8);
    var buffer = new ArrayBuffer(44 + dataLength);
    var data = new DataView(buffer);
    var offset = 0;
    var writeString = function (str) {
      for (var i = 0; i < str.length; i++) {
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
    data = this.reshapeWavData(sampleBits, offset, bytes, data);
    return new Blob([data], { type: "audio/wav" });
  };

  function H5MediaRecorder(config) {
    initUserMedia();
    checkTypeSupported();
    this.constraints = config.constraints;
    this.context = null;
    this.recorder = null;
    this.config = config;
    this.recording = false;
    this.videoChunks = [];
    this.audioDataUtil = new AudioDataUtil({
      channelCount: 1,
    });
  }

  H5MediaRecorder.prototype.start = function () {
    if (this.context && this.context.state === "suspended") {
      this.context.resume()
      this.recording = true
      return
    }

    if (this.recording) {
      return;
    }

    const success = (stream) => {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      // https://developer.mozilla.org/zh-CN/docs/Web/API/AudioContext/createScriptProcessor

      let context = this.context;
      this.recorder = context.createScriptProcessor(0, 1, 1);
      let sampleRate = context.sampleRate;
      this.audioDataUtil.inputSampleRate = sampleRate;
      this.audioDataUtil.outputSampleRate = sampleRate;

      this.recorder.onaudioprocess = (e) => {
        let lData = e.inputBuffer.getChannelData(0);
        if (!this.recording) {
          return;
        }
        this.audioDataUtil.input(lData);
      };
      if (this.constraints.video) {
        let mediaRecorder = new MediaRecorder(stream, {
          audioBitsPerSecond: sampleRate || 16000,
          videoBitsPerSecond: sampleRate || 256000,
          mimeType: "video/webm",
        });
        mediaRecorder.start();

        mediaRecorder.onstop = function (e) {
          videoBlob = new Blob(this.videoChunks, { type: "video/mp4" });
        };

        mediaRecorder.ondataavailable = function (e) {
          this.videoChunks.push(e.data);
        };
      }

      const audioInput = context.createMediaStreamSource(stream);

      audioInput.connect(this.recorder);
      this.recorder.connect(context.destination);
    };

    navigator.mediaDevices
      .getUserMedia(this.constraints)
      .then((stream) => {
        this.config.success(stream);
        success(stream);
      })
      .catch((error) => {
        console.log(error.name + ": " + error.message);
      });
    this.recording = true;
  };

  H5MediaRecorder.prototype.getBlob = function () {
    return this.audioDataUtil.getFullWavData();
  };

  H5MediaRecorder.prototype.stop = function () {
    if (!this.recording) {
      return;
    }
    this.recording = false;
  };

  H5MediaRecorder.prototype.paused = function () {
    if (this.context && this.context.state === "running") {
      this.context.suspend();
    }
  };

  H5MediaRecorder.prototype.download = function (fileName) {
    let blob = this.getBlob();
    let a = document.createElement("a");
    a.href = window.URL.createObjectURL(blob);
    a.download = (fileName || new Date().getTime()) + ".wav";
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(blob);
    document.body.removeChild(a);
  };
  return H5MediaRecorder;
});
