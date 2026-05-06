# MediaPipe 本地模型库

请把 Pose Landmarker 模型文件放在本目录：

```text
pose_landmarker_full.task
```

推荐路径：

```text
public/mediapipe/models/pose_landmarker_full.task
```

部署后浏览器访问路径为：

```text
/mediapipe/models/pose_landmarker_full.task
```

这样项目运行时会优先从本地模型库加载，不再依赖 `storage.googleapis.com`。
