from flask import Flask, stream_with_context, request, Response, jsonify, send_file
import io
import base64
import requests
import json
import openai
import asyncio
import time
import ssl
import pymongo
import smtplib
from random import sample
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from string import ascii_letters, digits
from wechatpayv3 import WeChatPay, WeChatPayType
import uuid
from tenacity import retry,stop_after_attempt,wait_random_exponential
from simple_lama_inpainting import SimpleLama
from PIL import Image

simple_lama = SimpleLama()

app = Flask(__name__)

with open('/home/ec2-user/config.json', 'r') as json_file:
    config_data = json.load(json_file)

appId = config_data.get('appId');
appSecret = config_data.get('appSecret');

MongoServer = config_data.get('MongoServer')

defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0';

APIV3_KEY = config_data.get('APIV3_KEY'); #APIv3
MCHID = config_data.get('MCHID');
CERT_SERIAL_NO = config_data.get('CERT_SERIAL_NO')
NOTIFY_URL = config_data.get('NOTIFY_URL')
with open('/home/ec2-user/微信支付_cert/apiclient_key.pem') as f:
    PRIVATE_KEY = f.read()

# 微信支付平台证书缓存目录，初始调试的时候可以设为None，首次使用确保此目录为空目录。
CERT_DIR = './cert'

# 接入模式：False=直连商户模式，True=服务商模式。
PARTNER_MODE = False

# 代理设置，None或者{"https": "http://10.10.1.10:1080"}，详细格式参见[https://requests.readthedocs.io/en/latest/user/advanced/#proxies](https://requests.readthedocs.io/en/latest/user/advanced/#proxies)
PROXY = None

# 初始化
# 初始化
wxpay = WeChatPay(
    wechatpay_type=WeChatPayType.NATIVE,
    mchid=MCHID,
    private_key=PRIVATE_KEY,
    cert_serial_no=CERT_SERIAL_NO,
    apiv3_key=APIV3_KEY,
    appid=appId,
    notify_url=NOTIFY_URL,
    cert_dir=CERT_DIR,
    partner_mode=PARTNER_MODE,
    proxy=PROXY)

openai.api_key = config_data.get('openai.api_key') #修改这里为自己申请的api_key

@app.route('/sendCodeToService', methods=['POST'])
def receive_code():
    try:
        # 获取客户端传递的数据
        data = request.get_json()
        code = data.get('code')

        #访问微信无服务端获取openid和session_key
        response = requests.get('https://api.weixin.qq.com/sns/jscode2session?appid=' + appId + '&secret=' + appSecret + '&js_code=' + code + '&grant_type=authorization_code');

        openid = response.json()['openid'];
        session_key = response.json()['session_key'];

        query = {"openid": openid}  # 以"name"字段为例，寻找"name"值为"John"的文档

        # 连接到MongoDB服务器
        client = pymongo.MongoClient(MongoServer)  # 请替换为你的MongoDB连接URI
        # 选择数据库
        db = client["微信小程序gpt"]  # 使用你的数据库名称
        # 选择集合
        collection = db["User"]  # 使用你的集合名称

        # 执行查询
        result = collection.find_one(query)

        #如何数据库没有这个用户,创建一个数据
        if(result == None):
            print("没有数据: ", result);
            # 准备要插入的数据
            data_to_insert = {
                "openid": openid,
                "nickname": "微信昵称",
                "avatarUrl": defaultAvatarUrl,
                #"vip": "New York",
                "availableMsg": 5
            }
            collection.insert_one(data_to_insert)

            client.close()

            data_to_insert.pop("_id", None)

            return jsonify({"userInfo": data_to_insert})
        else:
            #把_id这一项信息移除掉
            result.pop("_id", None)
            return jsonify({"userInfo": result})

    except Exception as e:
        # 处理异常情况
        return jsonify({"error": str(e)})

@app.route('/checkGPTApi', methods=['POST'])
#如果completion获得timeout的错误，然后就启动retry方程，重新运行handle_checkGpt
@retry(wait=wait_random_exponential(min=1, max=1),stop=stop_after_attempt(6))
async def handle_checkGpt():
    try:
        # 获取客户端传递的数据
        data = request.get_json()
        message = data.get('message')
        # 在实际应用中，这里可以根据code执行相应的业务逻辑

        print("来在测试api的请求")
        
        #访问chat gpt api,并获取答案
        completion = await asyncio.to_thread(openai.ChatCompletion.create,
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": message}],
            max_tokens=10,
            request_timeout=5
        )
        return jsonify({"message": completion.choices[0].message.content})

    except Exception as e:
        # 处理异常情况
        print("error: " , e);
        raise Exception("Error message")

@app.route('/chatWithChatGPT', methods=['POST'])
#如果completion获得timeout的错误，然后就启动retry方程，重新运行handle_chatWithChatGPT
@stream_with_context
def handle_chatWithChatGPT():

    # 获取客户端传递的数据
    data = request.get_json()
    message = data.get('message')

    #because stream_with_content only for regular generate function not for async, so I modify it
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    iter = iter_over_async(async_generate(message), loop)

    return Response(stream_with_context(iter), content_type='application/json')
    # 使用 stream_with_context 包装生成器函数
    #return Response(stream_with_context(generate(message)), content_type='application/json')


def iter_over_async(ait, loop):
    ait = ait.__aiter__()
    async def get_next():
        try: obj = await ait.__anext__(); return False, obj
        except StopAsyncIteration: return True, None
    while True:
        done, obj = loop.run_until_complete(get_next())
        if done: break
        yield obj

async def async_generate(message):
    retries = 6  # Set the maximum number of retries

    #当里面有lastQuestion代表不是第一个问的，里面就有lastQuestion和lastResponse数据
    if('lastQuestion' in message):
        messages = [
                        {"role": "user", "content": message['lastQuestion']},
                        {"role": "assistant", "content": message['lastResponse']},
                        {"role": "user", "content": message['question']}
                    ]
    #当里面没有lastQuestion代表是第一个问的，里面没有lastQuestion和lastResponse数据
    else:
        messages=[
            {"role": "user", "content": message['question']}
         ]

    for _ in range(retries):
        try:
            print("来在测试chat with api的请求")

            #访问chat gpt api,并获取stream流体答案
            for resp in openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages= messages,
                stream=True,
                request_timeout=5
            ):
                await asyncio.sleep(0)
                #finish_reason不是None，代表最后一个了
                if(resp.choices[0].finish_reason != None):
                    break

                result = resp.choices[0].delta.content
                yield result

            # If the loop completes without breaking, no exception occurred
            return
        except Exception as e:
            print("Timeout error: ", e)

        # Sleep for a short duration before retrying
        wait_random_exponential(min=1, max=1)


@app.route('/updateUserInfo', methods=['POST'])
# 更新客户数据
def handle_updateUserInfo():
    # 获取客户端传递的数据
    data = request.get_json()
    userInfo = data.get('userInfo')

    openid = userInfo['openid'];
    query = {"openid": openid};  # 以"name"字段为例，寻找"name"值为"John"的文档

    new_data = {"$set": { "nickname": userInfo['nickname'], "avatarUrl": userInfo['avatarUrl'], "availableMsg": userInfo['availableMsg']}};

    # 连接到MongoDB服务器
    client = pymongo.MongoClient(MongoServer)  # 请替换为你的MongoDB连接URI
    # 选择数据库
    db = client["微信小程序gpt"]  # 使用你的数据库名称
    # 选择集合
    collection = db["User"]  # 使用你的集合名称

    collection.update_one(query,new_data);

    client.close()

    return jsonify({"message": "User info updated successfully"})

@app.route('/feedback', methods=['POST'])
def handle_feedback():
    # 获取客户端传递的数据
    data = request.get_json()

    _type = data.get('type');
    feedbackContent = data.get('feedbackContent');
    contactInfo = data.get('contactInfo');

    body = "类型： " + _type + '\n内容：' + feedbackContent + '\n联系方式：' + contactInfo;

    sendEmail(body);
    return jsonify({"message": "Send message successful"})

@app.route('/sendPaymentRequest', methods=['POST'])
def handle_sendPaymentRequest():
    # 获取客户端传递的数据
    data = request.get_json()

    price = data.get('price');
    openid = data.get('openid');

    return jsonify({'result': pay_jsapi(price, openid)});

@app.route('/checkGiftCard', methods=['POST'])
def handle_checkGiftCard():
    # 获取客户端传递的数据
    data = request.get_json()
    giftCard = data.get('giftCard');

    query = {"giftCard": giftCard}  

    # 连接到MongoDB服务器
    client = pymongo.MongoClient(MongoServer)  # 请替换为你的MongoDB连接URI
    # 选择数据库
    db = client["微信小程序gpt"]  # 使用你的数据库名称

    giftCollection = db['GiftCard']

    # 执行查询
    result = giftCollection.find_one(query)

    if(result == None):
        print("没有giftcard: ", result);
        client.close()
        return jsonify({'message': False});
    else:
        print("有giftcard: ", result);
        delete_condition = {"giftCard": giftCard}

        #使用过之后，从数据库取消掉
        giftCollection.delete_one(delete_condition)
        client.close()
        return jsonify({'message': True});

def pay_jsapi(price, openid):
    out_trade_no = ''.join(sample(ascii_letters + digits, 8))
    description = '聊天机器人'

    amount = int(price * 100); #amount 是按照多少0.01来计算的，所以收10块，要写1000
    payer = {'openid': openid}
    code, message = wxpay.pay(
        description=description,
        out_trade_no=out_trade_no,
        amount={'total': amount},
        pay_type=WeChatPayType.JSAPI,
        payer=payer
    )

    result = json.loads(message)

    if code in range(200, 300):

        prepay_id = result.get('prepay_id')
        timestamp = str(int(time.time()))
        noncestr = str(uuid.uuid4()).replace('-', '')
        package = 'prepay_id=' + prepay_id

        sign = wxpay.sign([appId, timestamp, noncestr, package])
        signtype = 'RSA'
        result = {
                    'code': 0, 
                    'result': {
                        'appId': appId,
                        'timeStamp': timestamp,
                        'nonceStr': noncestr,
                        'package': 'prepay_id=%s' % prepay_id,
                        'signType': signtype,
                        'paySign': sign
                    }
                }
    else:
        result = {'code': -1, 'result': {'reason': result.get('code')}}

    return result;

#发送邮件
def sendEmail(body):
    # 邮件配置
    sender_email = config_data.get('sender_email')  # 发件人邮箱地址
    receiver_email = config_data.get('receiver_email')  # 收件人邮箱地址
    subject = "来自gpt小程序的建议反馈"

    # 邮件服务器配置
    smtp_server = "smtp.gmail.com"  # SMTP 服务器地址（这里以 Gmail 为例）
    smtp_port = 587  # SMTP 端口号
    smtp_user = config_data.get('smtp_user')  # 发件人邮箱用户名
    smtp_password = config_data.get('smtp_password')  # 发件人邮箱密码

    # 创建邮件对象
    msg = MIMEMultipart()
    msg["From"] = sender_email
    msg["To"] = receiver_email
    msg["Subject"] = subject

    # 添加邮件正文
    msg.attach(MIMEText(body, "plain"))

    # 连接到 SMTP 服务器并发送邮件
    try:
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()  # 使用 TLS 加密连接
        server.login(smtp_user, smtp_password)
        server.sendmail(sender_email, receiver_email, msg.as_string())
        server.quit()
        print("邮件发送成功")
    except Exception as e:
        print("邮件发送失败:", e)


@app.route('/notify', methods=['POST'])
def notify():
    result = wxpay.callback(request.headers, request.data)
    if result and result.get('event_type') == 'TRANSACTION.SUCCESS':
        resp = result.get('resource')
        appid = resp.get('appid')
        mchid = resp.get('mchid')
        out_trade_no = resp.get('out_trade_no')
        transaction_id = resp.get('transaction_id')
        trade_type = resp.get('trade_type')
        trade_state = resp.get('trade_state')
        trade_state_desc = resp.get('trade_state_desc')
        bank_type = resp.get('bank_type')
        attach = resp.get('attach')
        success_time = resp.get('success_time')
        payer = resp.get('payer')
        amount = resp.get('amount').get('total')
        # TODO: 根据返回参数进行必要的业务处理，处理完后返回200或204
        return jsonify({'code': 'SUCCESS', 'message': '成功'})
    else:
        return jsonify({'code': 'FAILED', 'message': '失败'}), 500


@app.route('/inPaintImage', methods=['POST'])
async def inPaintImage():   
    print("receive inPaintImage request")
    data = request.get_json()

    #get base64 of image
    image = data.get('image');
    mask = data.get('mask');

    # Decode the Base64 string into bytes
    image_bytes = base64.b64decode(image);
    mask_bytes = base64.b64decode(mask);

    # Create a BytesIO object to simulate a file-like object
    image_buffer = io.BytesIO(image_bytes)
    mask_buffer = io.BytesIO(mask_bytes)

    # Open the image using Pillow
    MYImage = Image.open(image_buffer).convert("RGB")
    MYMask = Image.open(mask_buffer).convert("L")

    width, height = MYImage.size;

    #图片宽尺寸大于400px，我使用resize把图片变小，模型处理速度加快，如果使用好的服务器就不用改变尺寸
    #改变尺寸方法会影响图片的质量
    if(width > 400):
        newWidth = 400;
        newHeight = round(height / width * newWidth);

        # 调整大小
        resized_img = MYImage.resize((newWidth, newHeight));
        resize_mask = MYMask.resize((newWidth, newHeight));

        resized_result = simple_lama(resized_img, resize_mask)

        # 放大图像
        result = resized_result.resize((width, height), Image.LANCZOS)
    else:
        result = simple_lama(MYImage, MYMask)
        result = result.resize((width, height), Image.LANCZOS)

    buffered = io.BytesIO()
    result.save(buffered, format="PNG")  # 根据需要选择图像格式
    base64_image = base64.b64encode(buffered.getvalue()).decode('utf-8')
 
    #发送二进制数据给client端
    return jsonify({'file_data': base64_image})
    
if __name__ == '__main__':
    ssl_context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
    #ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ssl_context.load_cert_chain(certfile='/home/ec2-user/key/xiaolailai.online_public.crt', keyfile='/home/ec2-user/key/xiaolailai.online.key')

    # 添加中间证书链
    ssl_context.load_verify_locations(cafile='/home/ec2-user/key/xiaolailai.online_chain.crt')

    # Start the Flask app

    app.run(host="0.0.0.0", port=443, ssl_context=ssl_context, threaded=True)

