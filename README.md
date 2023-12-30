## <font color='red'>由于ChatGPT内容属于小程序平台未开放的服务范围，小程序适合自用以规避风险</font>

## finish_stream 
可以进行流体传播的半成品 

## mutipleUserChat
websocket流体传播的成品

## mutipleUserChatHttp
http访问的成品，我觉得比websocket会中途断联更加稳定

## ChatGPT微信小程序源码
前端部署
-----------------------------------
修改app.js里面的serverUrl到服务器地址

后端部署
-----------------------------
## 接口部署
1. 首先需要有一台外区的服务器，服务器环境要求python3.10以上版本，安装flask框架
2. 拷贝index.py，微信支付_cert,和key文件夹到flask运行目录，
3. 配置文档
4. 运行项目 `sudo python index.py`

# 安装Python
Install Python 3.10.1

第一步：安装Python3环境
1.首先安装编译环境(后续需要从python官网获取Python3的源码自己编译python
```bash
yum install zlib-devel bzip2-devel openssl-devel ncurses-devel sqlite-devel readline-devel tk-devel gcc make

wget https://python.org/ftp/python/3.10.1/Python-3.10.1.tar.xz

tar -xvJf Python-3.10.1.tar.xz 

cd Python-3.10.1/

./configure prefix=/usr/local/python

make && make install

ln -s /usr/local/python/bin/python3 /usr/bin/python

 ln -s /usr/local/python/bin/pip3 /usr/bin/pip
```

# PIP安装各种依赖包

```bash
pip install flask
pip install requests
pip install openai
pip install pymongo
pip install wechatpayv3
pip install tenacity
pip install Flask[async]
```

```bash
pip install simple_lama_inpainting
这个比较麻烦，通常tmp文档不够位置，需要自己分开一个一个文件下载安装
我自己就是分开很多个包在windows下载然后上传给服务器
下载的文件
nvidia_cublas_cu12-12.1.3.1-py3-none-manylinux1_x86_64.whl
nvidia_cudnn_cu12-8.9.2.26-py3-none-manylinux1_x86_64.whl
nvidia_cusolver_cu12-11.4.5.107-py3-none-manylinux1_x86_64.whl
nvidia_cusparse_cu12-12.1.0.106-py3-none-manylinux1_x86_64.whl
nvidia_nccl_cu12-2.18.1-py3-none-manylinux1_x86_64.whl
torch-2.1.1-cp310-cp310-manylinux1_x86_64.whl

然后运行 pip install xxxx.whl文件来分步骤安装
echo "tmpfs /tmp tmpfs nodev,nosuid,size=1G 0 0" >> /etc/fstab    //  将/tmp文件更改为1G的空间
reboot
```

# 注意事项
运行simple_lama_inpainting的时候很容易因为内存不足导致程序失败，需要用swap增加虚拟内存
```bash
sudo dd if=/dev/zero of=/mnt/2GB.swap bs=1M count=2048
 sudo mkswap /mnt/2GB.swap
 sudo chmod 600 /mnt/2GB.swap
sudo swapon /mnt/2GB.swap
```

# 修改事项
```bash
1. 修改index.py里面的openai.key(yuzhuochen12@gmail.com)和mongodb(yuzhuochen12@gmail.com)
2. 修改index.py里面的gmail，appId，appSecret，mongoclient,APIV3_KEY,MCHID,CERT_SERIAL_NO,NOTIFY_URL（填写 "服务器/notify比如https://xiaolailai.online/notify）
3. 修改app.js里面的serverUrl到服务器地址
4. 把微信支付_cert文件夹和key文件夹放到和index.py同一个目录
```

# winscp登录aws service
```bash
1. host name: ec2-18-144-59-89.us-west-1.compute.amazonaws.com (public IPv4 DNS)
2. username              ec2-user
3. 高级-> SSH -> 验证     密匙文件放入ppk文件
```

# 使用systemd（linux）来重启是时候启动服务器和一直运行服务器** 使用myapp.service
把myapp.service放在文件夹/etc/systemd/system
运行代码

```bash
sudo systemctl enable myapp
sudo systemctl start myapp
```

# 更改域名，因为微信需要绑定服务器域名，不能用ip
阿里云买了域名 
xiaolailai.online
2024-10-31 23:59:59 过期
然后修改阿里云的dns 再修改aws的route 53把这个域名绑定上去

# 申请SSL
阿里云可以免费申请DV SSL证书
然后下载apache的文件包（key chain_crt 和public_crt）

# 域名还需要icp备案:微信小程序要求
# 微信还需要注册一个微信支付平台

阿里云账号(国内) 域名xiaolailai.online
用支付宝扫码登录 626-780-1390

aws服务器 （一年免费Oct 22 2024到期）
novascreen1234@gmail.com登录

mongodb
yuzhuochen12@gmail.com登录

微信小程序和微信支付平台 
ychen259账户登录管理

### 目前openai加强了api key的违规检测，对于直接部署在云函数的接口，因为IP不固定等原因很容易封号，现有两个解决方案
1. 有自己的备案域名，绑定到自己部署的服务器地址即可
2. 无备案域名，使用阿里云云函数创建nginx进行反向代理到你在外区所部署的接口服务器，使用云函数分配的url为接口地址

