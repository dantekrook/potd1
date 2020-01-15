var express = require("express");
var app = express();
var parser = require("body-parser");
var path = require("path");
var sqlite3 = require("sqlite3").verbose();
const multer = require("multer");
var fs = require("fs");
const session = require("express-session");
const DBSOURCE = "databas.db";
let db = new sqlite3.Database(DBSOURCE, err => {
    if (err) {
        console.error(err.message);
        throw err;
    } else {
        console.log("Connected to the SQlite database.");
    }
});
var storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, "public/upload");
    },
    filename: function(req, file, cb) {
        cb(null, file.fieldname + "-" + Date.now());
    }
});

var upload = multer({ storage: storage });
app.use(session({ secret: "ssshhhhh", saveUninitialized: true, resave: true }));

var sess;

const url = "http://localhost:8000";

app.use(express.static(__dirname + "/public"));

app.use(parser.urlencoded({ extended: false }));
app.use(parser.json());

app.use(function(req, res, next) {
    res.locals.userValue = null;
    next();
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.post("/loginuser", function(req, res) {
    var email = req.body.email;
    email = email.toLowerCase();
    var password = req.body.password;
    var sql = `SELECT id, COUNT(*) AS logged FROM users WHERE password="${password}" AND email="${email}" AND active="${1}"`;
    db.get(sql, function(err, row) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        if (row.logged) {
            console.log("Användaren är aktiv och hittades i databasen");
            sess = req.session;
            sess.email = email;
            sess.userid = row.id;
            sql = `SELECT id, COUNT(*) AS logged FROM users WHERE password="${password}" AND email="${email}" AND active="${1}" and admin="${1}"`;
            db.get(sql, function(err, row) {
                if (err) {
                    res.status(400).json({ error: err.message });
                    return;
                }
                if (row.logged) {
                    console.log("Användaren är admin");
                    sess.admin = 1;
                    res.render("admin", { url: url });
                } else {
                    console.log("Vanlig användare");
                    res.render("upload", { url: url });
                }
            });
        }
    });
});

app.post("/signup", function(req, res) {
    var email = req.body.email;
    email = email.toLowerCase();
    console.log(email);
    var password = req.body.password;
    var sql = `SELECT COUNT(*) AS antal FROM users WHERE email="${email}"`;
    db.get(sql, function(err, row) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        var userid = 0;
        if (row.antal) {
            console.log("Användare finns redan");
        } else {
            console.log("Lägger till användare");
            db.run(
                `INSERT INTO users(email, password, active) VALUES("${email}", "${password}", "${0}")`,
                function(err) {
                    if (err) {
                        return console.log(err.message);
                    }
                    console.log(
                        `A row has been inserted with rowid ${this.lastID}`
                    );
                    userid = this.lastID;
                    if (userid) res.json({ id: userid });
                    else res.json({ id: 0 });
                }
            );
        }
    });
});

// function getFileName(file) {
//   var arr = file.split(".");
//   return "." + arr[1];
// }

app.post("/upload", upload.single("image"), (req, res, next) => {
    const file = req.file;
    if (!file) {
        const error = new Error("Please upload a file");
        error.httpStatusCode = 400;
        return next(error);
    }
    res.send(file);
});

app.get("/active", (req, res, next) => {
    var sql = "select * from picture WHERE active = 1";
    var params = [];
    db.all(sql, params, (err, rows) => {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({
            message: "success",
            data: rows
        });
    });
});

/*app.post("/upload", function (req, res) {
  sess = req.session;
  if (sess.email) {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).send("No files were uploaded.");
    }
    let currentTime = new Date();
    currentTime = currentTime
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");
    let sampleFile = req.files.image;

    let uploadPath = __dirname + "/public/upload/" + sampleFile.name;
    sampleFile.mv(uploadPath, function (err) {
      if (err) {
        return res.status(500).send(err);
      }
      // var lastID;
      db.run(
        `INSERT INTO picture(url, datum, active, userid) VALUES("${sampleFile.name}", "${currentTime}", 0, ${sess.userid})`,
        function (err) {
          if (err) {
            return console.log(err.message);
          }
          lastID = this.lastID;
          var idfile = lastID + getFileName(sampleFile.name);
          db.run(
            `UPDATE picture SET url = "${idfile}" WHERE id = "${lastID}"`,
            function (err) {
              fs.rename(
                uploadPath,
                __dirname + "/public/upload/" + idfile,
                function (err) {
                  if (err) console.log("ERROR: " + err);
                }
              );
            }
          );
        }
      );
      // res.redirect("/");
    });
  } else {
    // res.render("login", { url: url });
  }
});*/

app.post("/sparabild", function(req, res) {
    let x = JSON.parse(req.body.image);
    console.log(req.body);
    console.log(x.mimetype);
    console.log(x.filename);
    console.log(req.body.bildtext);

    let currentTime = new Date();
    currentTime = currentTime
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");

    let filename = "";
    if (x.mimetype == "image/jpeg") {
        filename += x.filename + ".jpg";
    } else if (x.mimetype == "image/png") {
        filename += x.filename + ".png";
    }
    let uploadPath = __dirname + "/public/upload/" + x.filename;

    db.run(
        `INSERT INTO picture(url, datum, active, userid) VALUES("${filename}", "${currentTime}", 0, ${sess.userid})`,
        function(err) {
            if (err) {
                return console.log(err.message);
            }
            console.log("nytt filnamn" + filename);
            fs.rename(
                uploadPath,
                __dirname + "/public/upload/" + filename,
                function(err) {
                    if (err) console.log("ERROR: " + err);
                }
            );

            let today = new Date();
            today.setDate(today.getDate());
            today = today
                .toISOString()
                .slice(0, 10)
                .replace(/-/g, "");
            var sql = `SELECT id, url, COUNT(*) AS uploaded from picture WHERE datum = "${today}" AND userid= "${sess.userid}"`;
            console.log(sql);
            db.get(sql, function(err, row) {
                if (err) {
                    res.status(400).json({ error: err.message });
                    return;
                }
                console.log("haspic");
                console.log(sess.userid);
                console.log(row.uploaded);
                if (row.uploaded) {
                    //fråga i databasen ifall användaren har en bild
                    let picurl = "http://localhost:8000/upload/" + row.url;
                    console.log("Uploaded already!");
                    res.render("haspic", { url: url, picurl: picurl });
                } else {
                    console.log("Not uploaded!");
                    res.render("upload", { url: url });
                }
                // res.render("upload", { url: url });
                // res.json({ message: "ok" })
            });
        }
    );
});

app.get("/picture", (req, res, next) => {
    let yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday = yesterday
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");
    var sql = `SELECT * from picture WHERE datum = "${yesterday}"`;
    var params = [];
    db.all(sql, params, (err, rows) => {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({
            message: "success",
            data: rows
        });
    });
});

app.post("/activate", (req, res, next) => {
    console.log(req.body.url);
    db.run(`UPDATE picture SET active = 0`, function(err) {
        if (err) console.log("ERROR: " + err);
    }).run(`UPDATE picture SET active = 1 WHERE url = "${req.body.url}"`);
    res.send("File activated!");
});

app.get("/logout", (req, res, next) => {
    req.session.destroy(err => {
        if (err) {
            console.log(err);
        } else {
            res.redirect("/");
        }
    });
});

app.get("/page/:page", function(req, res) {
    res.render(req.params.page, { url: url });
});

app.get("/", function(req, res) {
    console.log("to picoftheday");
    res.render("picoftheday", { url: url });
});

app.get("/login", function(req, res) {
    console.log("Ladda localhost");
    sess = req.session;
    if (sess.email) {
        console.log("logged in");
        if (sess.admin) {
            console.log("is admin");
            res.render("admin", { url: url });
        } else {
            console.log("is not admin");
            res.render("upload", { url: url });
        }
    } else {
        console.log("not logged in");
        res.render("login", { url: url });
    }
});

app.listen(8000, function() {
    console.log("server running on port 8000");
});
