# GitHub Pages 在线部署说明

本工程已经配置好 GitHub Pages 自动部署。你只需要把整个工程上传到一个公开仓库。

## 一、创建公开仓库

1. 登录 GitHub。
2. 点击右上角 `+`。
3. 选择 `New repository`。
4. Repository name 建议填写：

```text
figure-drawing-evaluator
```

5. Visibility 选择：

```text
Public
```

6. 点击 `Create repository`。

## 二、上传本工程

把本压缩包解压后的所有文件上传到仓库根目录。

仓库根目录应该能看到：

```text
package.json
vite.config.js
index.html
src/
public/
.github/workflows/deploy.yml
```

注意：`.github` 文件夹不要漏传。

## 三、开启 GitHub Pages

进入仓库页面：

```text
Settings → Pages
```

在 `Build and deployment` 中：

```text
Source: GitHub Actions
```

保存即可。

GitHub 官方文档也说明，GitHub Pages 可以通过 GitHub Actions workflow 发布站点。

## 四、等待自动部署

上传文件到 `main` 分支后，进入：

```text
Actions
```

等待 `Deploy to GitHub Pages` 任务完成。

完成后，网站地址通常是：

```text
https://你的用户名.github.io/仓库名/
```

例如：

```text
https://weicewang.github.io/figure-drawing-evaluator/
```

## 五、MediaPipe 模型说明

本项目可以部署到 GitHub Pages，但 MediaPipe 模型文件有两种方式：

### 方式 A：不放本地模型

项目可以正常部署。系统会尝试官方模型源；如果模型源加载失败，仍然可以使用参考图手动校准和线稿图像评分模式。

### 方式 B：放入本地模型

将模型文件放到：

```text
public/mediapipe/models/pose_landmarker_full.task
```

然后提交到 GitHub。部署后项目会优先从本项目路径加载模型。

注意：模型文件较大，GitHub 普通仓库可以放，但不建议反复提交大文件。若文件太大，可考虑学校服务器、阿里云 OSS 或腾讯云 COS，然后在 `.env` 中配置模型地址。

## 六、常见问题

### 1. 页面空白

检查：

```text
Actions 是否部署成功
Settings → Pages 是否选择 GitHub Actions
vite.config.js 是否存在
```

### 2. 图片上传可以用，但参考骨架不识别

可能是模型文件未加载成功。可以继续使用参考图手动校准模式。

### 3. 线稿为什么不显示骨架？

这是当前需求设定：线稿只显示原图，不显示骨架、不显示可拖动关键点，评分根据参考图基准和线稿图像特征生成。
