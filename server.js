const express = require('express'); 
//初始化 dotenv

require('dotenv').config();

const app = express();

const path = require('path');

const port = process.env.SERVER_PORT || 3002  //預設值設定3002

const bcrypt = require('bcrypt');

const { body, validationResult } = require('express-validator');

const cors = require('cors');

const corsOptions = {
    credentials: true, //如果要讓cookie可以跨網域存取且origin也要設定
    origin: ['http://localhost:3000'], //前端是誰
};

// chat Room
const http = require('http');
const server = http.createServer(app); //nodejs內建的http功能建立原生Server
// 並將 express 放進 http 中開啟 Server 
//  !  使用server 開啟 而非app
//將啟動的 Server 送給 socket.io 處理
const { Server } = require("socket.io"); 
const io = new Server(server, {
    // 處理跨網域
  cors: {
    origin: "http://localhost:3000", //前端是誰
    credentials: true
  }
}); 

//當有client連線時，觸發connection 事件
io.on('connection', (socket) => {
    console.log('connection success! a user connected'); //前端連線後端成功
    console.log('socket id', socket.id)

    socket.emit('message', 'welcome to chat') // 發送 - 單一user
    // io.emit() //發送 - all the client    
    // socket.broadcast.emit('message','A user has joined the chat') //發送 -  everybody except the user connecting

    //離線狀態 斷線事件
    socket.on('disconnect', () => {
        console.log('user disconnected');
        io.emit('leftMessage','the user has left the chat')
});
    // Listene for chatMessage --> 接收前端的socket訊息 [聽] "chat"的事件名稱
    socket.on('chatMessage', (msg) => {
        console.log('socket:msg from chat', msg)
        //發送
        io.emit('message',msg)
    })
});


app.use(cors(corsOptions));

//啟用seesion
const expressSession=require('express-session')
//硬碟配置 把session存在印碟
const FileStore=require('session-file-store')(expressSession)
app.use(expressSession({
    name:'user_identityKey',
    store: new FileStore({
        // 儲存路徑
        path:path.join(__dirname,'..','sessions')
    }),
    cookie: { maxAge: 365 * 24 * 60 * 60 * 1000 },  //單位：毫秒
    secret: process.env.SESSION_SECRET,
    resave:false, // 如果session沒有改變 要不要重新儲存一次
    saveUninitialized: false // 還沒初始化的 要不要存（每次只要有請求來就會開一個暫時的檔案夾）
}))



const mysql = require("mysql2");
let pool = mysql
    .createPool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME, 
        // 限制 pool 連線數的預設=上限
        connectionLimit: 10,
        // 保持 date 是 string，不要轉成 js 的 date 物件 
        dateStrings: true,
    }).promise();

const uuid = require('uuid');
// FormData / Content-Type: multipart/form-data =>使用multer套件解析
const multer = require('multer');
const session = require('express-session');



// [middleware] - 驗證註冊資料
const registerRules = [
    // check email格式
    body('email').isEmail().withMessage('Email欄位請填寫正確'),
    //check 密碼長度
    body('password').isLength({ min: 4 }).withMessage('長度不得小於4').isLength({ max: 12 }).withMessage('長度不得大於12'),
    //check 密碼與確認密碼是一致
    body('confirmPassword').custom((value, { req }) => {
        return value === req.body.password;
    }).withMessage('密碼驗證不一致')
    ]

// 圖片存在disk
const gallery = multer.diskStorage({
    // 1 - 存在 public / uploads 的檔案夾
    destination: function (req, file, cb) {
        // params(錯誤訊息,取得的資料,)
        cb(null, path.join(__dirname , 'public','uploads',)
);
        // path.join程式自動判別作業系統路徑寫法 (避免不同作業系統的 / 和 \ )
    },
    // 2 - 圖片名稱 (使用原始檔名會有重複命名存進資料庫的風險)
    filename: function (req, file, cb) {
        console.log('file',file)
        // 保留副檔名取最後一個.
        let filename = uuid.v1();
        const ext = file.originalname.split('.').pop()
        // 檔名 np賦予新命名
        cb(null,`member-${filename}.${ext}`)
    }
});

// [middleware ] - 解析上傳圖片
const uploader = multer({
  // 存哪
    storage: gallery,
 //過濾圖片總類
    fileFilter: function (req, file, cb) {
        if (file.mimetype !== 'image/jpeg' && file.mimetype !== 'image/jpg' && file.mimetype !== 'image/png' && file.mimetype !== 'application/pdf') {
            cb(new Error('不接受上傳的檔案格式'), false);
        } else {
            cb(null, true);
        }
    },
 //檔案大小
    limits: {
        fileSize: 20*1024*1024,
    }
    
})

// * -- API

 // express 中若要解讀json資料要依賴內建中間件
app.use(express.json());

// express 內建 - 設置靜態檔案(檔案夾路徑轉成網址) express.static ->讓靜態檔案有網址
// localhost:3002/uploads/member-aa1c8790-7314-11ed-87d4-eb57dc025399.png
app.use(express.static(path.join(__dirname,'public'))) // 設置 static photo檔案夾



//  * 註冊

app.use('/api/1.0/auth/register',registerRules,async (req, res, next) => {
    // * 驗證資料格式是否正確 （npm i express-validator)
    // 放入 registerRules
    // 取驗證結果
    const validateResult = validationResult(req);
    console.log('validationResult req', validateResult);
    //validationResult.isEmpty() => 格式沒有錯誤
    if (!validateResult.isEmpty()) {
        return res.status(400).json({ message: validateResult.array() });
    }

     // * 資料寫進DB
    console.log(req.body) // check 是否有收到
    // express 中若要使用json資料要依賴內建中間件
    //res.json({}) //有時沒有讀到可能是Content-Type解析有誤
    //檢查是否有重複註冊的email
    let Data = await pool.execute('SELECT * FROM users WHERE email=?', [req.body.email]);
    console.log('result', Data);
    console.log('data', Data[0]);
    let user = Data[0]
    //若為空陣列的狀態 => 代表email未註冊過
    if (user.length == 0) {
        // try {
        //密碼雜湊
            let hashPassword = await bcrypt.hash(req.body.password, 10);
        //資料存入資料庫
            let result=await pool.execute('INSERT INTO users(email, name, password , valid) VALUES(?,?,?,1); ',[req.body.email,req.body.fullName,hashPassword]);
            console.log('確認結果', result)
        res.json({ message: 'ok' });
       
    } else {
    //若非空陣列狀態 ＝>註冊過
       return res.status(400).json({ message: "email重複註冊" });
    }
})

// * 登入（不能告訴使用者太詳盡的資料）
//  TODO 回覆前端登入成功

app.use('/api/1.0/auth/login', async (req, res, next) => {
    //確認email是否有註冊過 （沒有回）401
    console.log('login', req.body) // check 是否有收到
    let Data = await pool.execute('SELECT * FROM users WHERE email=?', [req.body.email]);
    let user = Data[0]
    if (user.length == 0) {
        // email沒有註冊過
        return res.status(400).json({ message: "帳號或密碼錯誤" });
    } else { 
    // 有註冊過 去比對密碼
        async function getLoginData() {
            let compareResult = await bcrypt.compare(req.body.password, user[0].password)
            console.log('compare', compareResult)

            if (compareResult) {
             //  比對成功 (1) jwt token 2. session/cookie
        let saveMember = {
        //存入session
            id: user[0].id,
            name: user[0].name,
            email: user[0].email,
            loginDt: new Date().toISOString(),
        }
        //資料存入session
              req.session.user = saveMember;
              console.log('saveMember',saveMember)
        res.json({ saveMember,message:'登入成功' })
        } else {
            return res.status(401).json({message:'登入失敗'})
        }
       
        }
        getLoginData();
        }
}
)
 

// * 登出
//清除session
app.get('/api/1.0/logout', function (req, res, next) {
    // 備註：這裡用的 session-file-store 在destroy 方法裡，並沒有銷毀掉cookie
    // 所以客户端的 cookie 還是存在，導致的问题 --> 退出登入後，服務端檢測到 cookie
    // 然後去找對應的session文件報錯
    // session-file-store 本身的bug
 
      req.session.destroy(() => {
    console.log('session destroyed')
  })
  res.render('index', { alert: 'You are logged out! Re-enter email and password to log in again!' })     
    //     res.clearCookie('identityKey');
    //     res.redirect('/');
})

 
//  * 登入後才可使用
// GET / users

app.get('/api/1.0/users', (req, res, next) => {
    // console.log(req.session)    
    //判斷是否登入
    if (!req.session.user) {
        //session內沒有user資料
    return res.status(40).json({message:'尚未登入'})
    }
    // 方法1 根據session內儲存的id去撈資料庫 (o:即時存取 x:頻繁撈取資料庫)
    // 方法2 直接回覆 session 裡資料 （note: 若有提供修改會員資料功能,去更新session）
    res.json(req.session.user)
})


// * 上傳檔案 (FormData 處理方式)
app.use('/api/1.0/sign',uploader.single('file'), async (req, res, next) => {
    // console.log('signup', req.body) // check 是否有收到
    // console.log('session',req.session.user)
    // res.json({})
    //判斷是否有收到檔案
    let filename = req.file ? '/uploads/' + req.file.filename : '';
    console.log('req.session',req.session)
    let userId=req.session.user.id 
    let insertData = await pool.execute('INSERT INTO files( name,valid,user_id) VALUES(?,1,?); ', [filename, userId]);
    let insertFile = insertData[0]
    console.log('insertFile',insertFile)
    let insertId = insertData[0].insertId
    console.log('insertId',insertId)
    let Data = await pool.execute('SELECT * FROM files WHERE id=(SELECT max(id) FROM files) AND user_id=?', [userId]);
    let lastFile=Data[0]
    console.log('lastFile', lastFile)
    let saveLastFile = {
        //存入session
            id: insertFile.insertId,
            name: lastFile[0].name,
        }
        //資料存入session
              req.session.file = saveLastFile;
              console.log('saveMember',saveLastFile)
    res.json({ saveLastFile }) 
})


 
// * GET / last File

app.get('/api/1.0/file', (req, res, next) => {
    // console.log(req.session)    
    //判斷是否登入
    if (!req.session.user) {
        //session內沒有user資料
    return res.status(401).json({message:'尚未登入'})
    }
    res.json(req.session.file)
})
 
    
// * GET / all Files
app.get('/api/1.0/files', async (req, res, next) => {
    // console.log('signup', req.body) // check 是否有收到
    // res.json({})
    //判斷是否有收到檔案
    let userId = req.session.user.id;
    let result = await pool.execute('SELECT * FROM files WHERE user_id=?', [userId]);
    console.log('result', result[0])
    res.json(result[0])
})



app.use((req, res, next) => {
    // console.log('這裡是中間件 404') 
 res.status(404).send('Not Found')
})


// !  使用server 開啟 而非app
//app.listen
server.listen(port, () => {
    console.log(`Server running at  port ${port}`);
})





