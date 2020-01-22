var express = require("express");
var app = express();
var parser = require("body-parser");
var path = require("path");
var sqlite3 = require("sqlite3").verbose();
const multer = require("multer");
var fs = require("fs");
const session = require("express-session");
const DBSOURCE = "databas.db";
var detect = require("detect-file-type");
var bcrypt = require("bcryptjs");
const saltRounds = 10;

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
    var sql = `SELECT id, password, active, COUNT(*) AS logged FROM users WHERE email="${email}" AND active="${1}"`;
    db.get(sql, function(err, row) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        if (row.logged) {
            bcrypt.compare(password, row.password, (error, response) => {
                if (error) {
                    console.log(error);
                } else {
                    console.log("Result is: " + response);
                    if (response == true) {
                        console.log(
                            "Användaren är aktiv och hittades i databasen"
                        );
                        sess = req.session;
                        sess.email = email;
                        sess.userid = row.id;
                        sql = `SELECT id, COUNT(*) AS isAdmin FROM users WHERE email="${email}" and admin="${1}"`;
                        db.get(sql, function(err, row) {
                            if (err) {
                                res.status(400).json({ error: err.message });
                                return;
                            }
                            if (row.isAdmin) {
                                console.log("Användaren är admin");
                                sess.admin = 1;
                                res.render("admin", { url: url });
                            } else {
                                console.log("Vanlig användare");
                                let today = new Date();
                                today.setDate(today.getDate());
                                today = today
                                    .toISOString()
                                    .slice(0, 10)
                                    .replace(/-/g, "");
                                var sql = `SELECT id, url, COUNT(*) AS antal FROM picture WHERE userid="${sess.userid}" AND datum="${today}"`;
                                db.get(sql, function(err, row) {
                                    if (err) {
                                        res.status(400).json({
                                            error: err.message
                                        });
                                        return;
                                    }
                                    if (row.antal) {
                                        console.log("Har laddat upp bild idag");
                                        let picurl =
                                            "http://localhost:8000/upload/" +
                                            row.url;
                                        res.render("haspic", {
                                            url: url,
                                            picurl: picurl
                                        });
                                    } else {
                                        console.log(
                                            "Har inte laddat upp bild idag"
                                        );
                                        res.render("upload", { url: url });
                                    }
                                });
                            }
                        });
                    } else {
                        res.render("login", {
                            url: url,
                            error: "Felaktigt lösenord"
                        });
                    }
                }
            });
        } else {
            if (row.active) {
                res.render("login", {
                    url: url,
                    error: "Email finns inte"
                });
            } else {
                res.render("login", {
                    url: url,
                    error: "Du är inte verifierad"
                });
            }
        }
    });
});

app.post("/signup", function(req, res) {
    bcrypt.hash(req.body.password, saltRounds, (err, hash2) => {
        if (err) {
            console.log(err);
        } else {
            var email = req.body.email;
            email = email.toLowerCase();
            var password = hash2;
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
        }
    });
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

app.post("/upload", upload.single("image"), (req, res, next) => {
    const file = req.file;
    if (!file) {
        const error = new Error("Please upload a file");
        error.httpStatusCode = 400;
        return next(error);
    }
    res.send(file.filename);
});

app.post("/sparabild", function(req, res) {
    console.log("bild id: " + req.body.image);
    let filename = "";
    detect.fromFile(__dirname + "/public/upload/" + req.body.image, function(
        err,
        result
    ) {
        if (err) {
            return console.log(err);
        }
        if (result.mime == "image/jpeg") {
            filename = req.body.image + ".jpg";
        } else if (result.mime == "image/png") {
            filename = req.body.image + ".png";
        }

        let today = new Date();
        today = today
            .toISOString()
            .slice(0, 10)
            .replace(/-/g, "");

        let uploadPath = __dirname + "/public/upload/" + req.body.image;

        db.run(
            `INSERT INTO picture(url, datum, active, userid) VALUES("${filename}", "${today}", 0, ${sess.userid})`,
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
                var sql = `SELECT id, url, COUNT(*) AS uploaded from picture WHERE datum = "${today}" AND userid= "${sess.userid}"`;
                db.get(sql, function(err, row) {
                    if (err) {
                        res.status(400).json({ error: err.message });
                        return;
                    }
                    if (row.uploaded) {
                        let picurl = "http://localhost:8000/upload/" + row.url;
                        console.log("Har redan laddat upp bild");
                        res.render("haspic", { url: url, picurl: picurl });
                    } else {
                        console.log("Har inte laddat upp bild");
                        res.render("upload", { url: url });
                    }
                });
            }
        );
    });
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

app.get("/delete", (req, res, next) => {
    let userId = sess.userid;
    let today = new Date();
    today.setDate(today.getDate());
    today = today
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");
    db.get(
        `SELECT url AS link FROM picture WHERE userid="${userId}" AND datum="${today}"`,
        function(err, row) {
            if (err) {
                res.status(400).json({ error: err.message });
                return;
            }
            if (row.link) {
                let uploadPath = __dirname + "/public/upload/" + row.link;
                fs.unlinkSync(uploadPath);
            }
        }
    );
    db.run(
        `DELETE FROM picture WHERE userid="${userId}" AND datum="${today}"`,
        function(err) {
            if (err) {
                return console.log(err.message);
            }
            console.log("Bild bortagen");
            res.render("upload", { url: url });
        }
    );
});

app.get("/page/:page", function(req, res) {
    res.render(req.params.page, { url: url });
});

app.get("/", function(req, res) {
    res.render("picoftheday", { url: url });
});

app.get("/login", function(req, res) {
    sess = req.session;
    if (sess.email) {
        console.log("Är redan inloggad");
        if (sess.admin) {
            console.log("Är admin");
            res.render("admin", { url: url });
        } else {
            console.log("Är inte admin");
            let today = new Date();
            today.setDate(today.getDate());
            today = today
                .toISOString()
                .slice(0, 10)
                .replace(/-/g, "");
            var sql = `SELECT id, url, COUNT(*) AS antal FROM picture WHERE userid="${sess.userid}" AND datum="${today}"`;
            db.get(sql, function(err, row) {
                if (err) {
                    res.status(400).json({ error: err.message });
                    return;
                }
                if (row.antal) {
                    console.log("Har laddat upp bild idag");
                    let picurl = "http://localhost:8000/upload/" + row.url;
                    res.render("haspic", { url: url, picurl: picurl });
                } else {
                    console.log("Har inte laddat upp bild idag");
                    res.render("upload", { url: url });
                }
            });
        }
    } else {
        console.log("Inte inloggad redan");
        res.render("login", { url: url, error: "" });
    }
});

app.listen(8000, function() {
    console.log("server running on port 8000");
});
