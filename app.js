const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");
const app = express();
app.use(express.json());
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server Running at http://localhost:3000/register/");
    });
  } catch (error) {
    console.log(`DB Error:${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

/*const convertUserObject=(dbObject)=>{
    return{
        userId:dbObject.user_id,
        name:dbObject.name,
        username:dbObject.username,
        password:dbObject.password,
        gender:dbObject.gender
    };
};



const convertFollowerObject=(dbObject)=>{
    return{
        follower_Id:dbObject.follower_id,
        follower_user_Id:dbObject.follower_user_id,
        following_user_Id:dbObject.following_user_id
    };
};

const convertTweetObject=(dbObject)=>{
    return{
            tweet_Id:dbObject.tweet_id,
            tweet:dbObject.tweet,
            user_id:dbObject.userId,
            date_time:dbObject.date_time,
    }
}

const convertReplyObject=(dbObject)=>{
    return{
        reply_Id:dbObject.reply_id,
        tweet_Id:dbObject.tweet_id,
        reply:dbObject.reply,
        user_Id:dbObject.user_id,
        date_time:dbObject.date_time
    };
};

const convertLikeObject=(dbObject)=>{
    return{
        like_Id:dbObject.like_id,
        tweet_Id:dbObject.tweet_id,
        user_Id:dbObject.user_id,
        date_time:dbObject.date_time
    };
};
*/

const getFollowingPeopleUser = async (username) => {
  const getTheFollowingPeopleQuery = `
    SELECT
    following_user_id FROM follower
    INNER JOIN user ON user.user_id=follower.follower_user_id
    WHERE user.username='${username}';`;

  const followingPeople = await db.all(getTheFollowingPeopleQuery);
  const arrayOfIds = followingPeople.map(
    (eachUser) => eachUser.following_user_id
  );

  return arrayOfIds;
};

//Authentication

const authentication = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader) {
    jwtToken = authHeader.split(" ")[1];
  }
  // if(jwtToken===undefined){
  //   response.status(401);
  // response.send("Invalid JWT Token");
  //}
  if (jwtToken) {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        request.userId = payload.userId;
        next();
      }
    });
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
};

//tweet access verification

const tweetAccessVerification = async (request, response, next) => {
  const { userId } = request;
  const { tweetId } = request.params;
  const getTweetQuery = `SELECT
    *
     FROM 
     tweet INNER JOIN follower ON tweet.user_id=follower.following_user_id
     WHERE
     tweet.tweet_id='${tweetId}' AND follower_user_id='${userId}';`;

  const tweet = await db.get(getTweetQuery);
  if (tweet === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    next();
  }
};

app.post("/register/", async (request, response) => {
  const { username, name, password, gender } = request.body;
  //const hashedPassword = await bcrypt.hash(password, 10);
  const checkTheUsername = `
            SELECT *
            FROM user
            WHERE username = '${username}';`;
  const userData = await db.get(checkTheUsername);
  //console.log(userData);
  if (userData !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const postNewUserQuery = `
            INSERT INTO
            user (username,password,name,gender)
            VALUES (
                '${username}',
                '${hashedPassword}',
                '${name}',
                '${gender}'
            );`;

      const dbResponse = await db.run(postNewUserQuery);
      //const newUserId = dbResponse.lastID;
      response.status(200);
      response.send("User created successfully");
      //}
    }
  }
});

//API 2

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  //const hashedPassword = await bcrypt.hash(password, 10);
  const checkTheUser = `
            SELECT *
            FROM user
            WHERE 
            username = '${username}';`;
  const userData = await db.get(checkTheUser);
  if (userData !== undefined) {
    const isPasswordMatched = await bcrypt.compare(password, userData.password);
    if (isPasswordMatched) {
      const payload = { username, userId: userData.user_id };

      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

//Authenticate jwt

//API 3

app.get("/user/tweets/feed/", authentication, async (request, response) => {
  const { username } = request;
  const followingPeopleIds = await getFollowingPeopleUser(username);

  const getTweetsQuery = `SELECT username,tweet,date_time as dateTime
    FROM user INNER JOIN tweet ON user.user_id=tweet.user_id
    WHERE
    user.user_id IN(${followingPeopleIds})
    ORDER BY date_time DESC
    LIMIT 4;`;
  const tweets = await db.all(getTweetsQuery);
  response.send(tweets);
});

//API4

app.get("/user/following/", authentication, async (request, response) => {
  const { username, userId } = request;
  const getFollowingUserQuery = `SELECT name FROM follower
    INNER JOIN user ON user.user_id=follower.following_user_id
    WHERE follower_user_id='${userId}';`;
  const followingPeople = await db.all(getFollowingUserQuery);
  response.send(followingPeople);
});

//API5

app.get("/user/followers/", authentication, async (request, response) => {
  const { username, userId } = request;

  const getFollowersQuery = `SELECT DISTINCT name FROM follower
    INNER JOIN user ON user.user_id=follower.follower_user_id
    WHERE following_user_id='${userId}';`;

  const followers = await db.all(getFollowersQuery);
  response.send(followers);
});

//API

app.get(
  "/tweets/:tweetId/",
  authentication,
  tweetAccessVerification,
  async (request, response) => {
    const { username, userId } = request;
    const { tweetId } = request.params;

    const getTweetQuery = `SELECT tweet,
    (SELECT COUNT() FROM Like WHERE tweet_id='${tweetId}') AS likes,
    (SELECT COUNT() FROM reply  WHERE tweet_id='${tweetId}') AS replies,
    date_time AS dateTime
    FROM tweet
    WHERE tweet.tweet_id='${tweetId}';`;
    const tweet = await db.get(getTweetQuery);
    response.send(tweet);
  }
);

//API7

app.get(
  "/tweets/:tweetId/likes/",
  authentication,
  tweetAccessVerification,
  async (request, response) => {
    const { tweetId } = request.params;
    const getLikesQuery = `SELECT username FROM user INNER JOIN like ON user.user_id=like.user_id
    WHERE tweet_id='${tweetId}';`;

    const likedUsers = await db.all(getLikesQuery);
    const usersArray = likedUsers.map((eachUser) => eachUser.username);
    response.send({ likes: usersArray });
  }
);

//api 8

app.get(
  "/tweets/:tweetId/replies/",
  authentication,
  tweetAccessVerification,
  async (request, response) => {
    const { tweetId } = request.params;
    const getRepliedQuery = `SELECT name,reply FROM user INNER JOIN reply ON user.user_id=reply.user_id
    WHERE tweet_id='${tweetId}';`;
    const repliedUsers = await db.all(getRepliedQuery);
    response.send({ replies: repliedUsers });
  }
);
//Api 9

app.get("/user/tweets/", authentication, async (request, response) => {
  const { userId } = request;

  const getTweetsQuery = `
    SELECT tweet,
    COUNT(DISTINCT like_id) AS likes,
    COUNT(DISTINCT reply_id) AS replies,
    date_time AS dateTime
    
    FROM tweet LEFT JOIN reply ON tweet.tweet_id=reply.tweet_id LEFT JOIN like ON tweet.tweet_id=like.tweet_id
    WHERE
    tweet.user_id=${userId}
    GROUP BY tweet.tweet_id;`;

  const tweets = await db.all(getTweetsQuery);

  response.send(tweets);
});

//api 10

app.post("/user/tweets/", authentication, async (request, response) => {
  const { tweet } = request.body;
  const userId = parseInt(request.userId);
  const dateTime = new Date().toJSON().substring(0, 19).replace("T", " ");
  const createTweetQuery = `INSERT INTO tweet(tweet,user_id,date_time)
    VALUES('${tweet}','${userId}','${dateTime}');`;

  await db.run(createTweetQuery);
  response.send("Created a Tweet");
});

//API 11

app.delete("/tweets/:tweetId/", authentication, async (request, response) => {
  const { tweetId } = request.params;
  const { userId } = request;
  const getTheTweetQuery = `SELECT * FROM tweet WHERE user_id='${userId}' AND tweet_id='${tweetId}';`;
  const tweet = await db.get(getTheTweetQuery);
  console.log(tweet);
  if (tweet === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const deleteTweetQuery = `DELETE FROM tweet WHERE tweet_id='${tweetId}';`;
    await db.run(deleteTweetQuery);
    response.send("Tweet Removed");
  }
});

module.exports = app;
