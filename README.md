# Scrum 線上簽署平台 - 後端

**<font size=20>操作步驟</font>**

- [ ] step1. 將專案從 github clone 到本地端，並安裝套件
終端機指令
```
git clone https://github.com/antiching/Scrum-backend.git

npm install


npm i nodemon （若本地端無nodemon 請多此步驟）
```

- [ ] step2.  於檔案夾SCRUM-BE內建立.env檔案.

- [ ] step3.  將.env.example檔裡的內容複製到.env檔裡，並修改資料如下 (連動資料庫)
```
DB_USER=admin

DB_PASSWORD=12345

SESSION_SECRET=test
```


- [ ] step4. 資料庫建置

請先安裝 **XAMPP** 並啟用 **Apache** 和 **MySQL**

於 MySQL 按照 **.env** 檔案中的 **DB_USER** 和 **DB_PASSWORD** 新增使用者帳號及密碼

建立 SCRUM 資料庫，並將後端根目錄的檔案 scrum.sql 匯入

- [ ] step5. 啟動後端專案　

```
npm run dev
```


與前端[scrum-fe](https://github.com/antiching/Scrum-frontend "Title")連動

**注意：**  請於 資料夾**scrum-be** 及 **scrum-fe** 同層建立資料夾命名為 **sessions**
