const express = require("express");
const app = express();
require("dotenv").config();
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.SECRET_KEY);
// const mongoose = require('mongoose');

const port = process.env.PORT || 5000;

//adding middlewares
app.use(cors());
app.use(express.json());
app.use(bodyParser.json()); // Handles JSON requests

// starting

//adding mongodb
const dbUser = process.env.DB_USER;
const dbPass = process.env.DB_PASS;
// console.log(dbUser,dbPass)

const uri = `mongodb+srv://${dbUser}:${dbPass}@cluster0.o9sii.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

//adding database collection
const menuColl = client.db("feastfusion").collection("menu");
const CartColl = client.db("feastfusion").collection("carts");
const usersColl = client.db("feastfusion").collection("users");
const PaymentHistoryColl = client
  .db("feastfusion")
  .collection("paymentHistory");

//it mongoos things
// const paymentHistorySchema = new mongoose.Schema({
//   email: String,
//   amount: Number,
//   status: String,
//   date: Date,
// });

// const PaymentHistoryColl = mongoose.model('PaymentHistory', paymentHistorySchema);

//setting up authorization middlewares
const verifyToken = (req, res, next) => {
  // Check if Authorization header exists
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "Forbidden access" });
  }

  const token = req.headers.authorization.split(" ")[1]; // Extract token

  // Verify the token using the private key
  jwt.verify(token, process.env.PRIVATE_KEY, function (err, decoded) {
    if (err) {
      // Token verification failed, return error response
      console.log(err);
      return res
        .status(401)
        .send({ message: "Forbidden access", error: err.message });
    }

    // If decoded is available, assign it to req.decoded and proceed to next middleware

    req.decoded = decoded;
    console.log("Decoded token:", decoded); // Add this line

    next(); // Proceed with the next middleware or route handler
  });
};

//adding verify middle admin middleware
const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email: email };

  const user = await usersColl.findOne(query);

  const isAdmin = user?.role === "admin";

  if (!isAdmin) {
    return res.status(403).send({ message: "forbidden access" });
  }

  next();
};

// let clientPromise;

// if (!clientPromise) {
//   clientPromise = client.connect();
// }
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await clientPromise;
    // Send a ping to confirm a successful connection

    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );

    app.get("/", (req, res) => {
      res.send("Hello World!");
    });
    app.get("/shafik", (req, res) => {
      res.send("Hello shafik!");
    });

    app.get("/test", async (req, res) => {
      res.send("shafik is testing food");
    });

    //addin items for users
    app.post("/addrecipie", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const data = req.body;
        const name = req.body.name;
        const query = { name: name }; // Search by unique recipe name
        // console.log( query) //checking the data getting correctly
        const update = { $setOnInsert: data }; // Insert only if it doesn't exist
        const options = { upsert: true };

        const newRecipie = await menuColl.updateOne(query, update, options);
        res.send(newRecipie);
      } catch (error) {
        console.error("error in adding recipe:", error);
        res.status(500).send({ message: "Error processing request" });
      }
    });

    //checking if the user has admin privililage
    app.get(
      "/user/admin/:email",
      verifyToken,

      async (req, res) => {
        const email = req.params.email;

        console.log("seing decoded email", req.decoded.email);

        // checking if the useris the real user
        if (email !== req.decoded.email) {
          return res.status(403).send({ message: "unauthorized access" });
          console.log("chking from beckend", req.decoded.email);
          res.send("chking from beckend", req.decoded.email);
        }

        const query = { email: email };
        const user = await usersColl.findOne(query);

        let admin = false;
        if (user) {
          admin = user?.role === "admin";
        }
        res.send({ admin });
      }
    );

    app.post("/allusers", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersColl.find().toArray();
      res.send(result);
      // console.log(result)
    });

    app.post("/users", async (req, res) => {
      const email = req.body.email;
      const query = { email: email };
      if (email) {
        // Construct the query to search by email
        const query = { email: email };

        // Find if the email already exists
        const find = await usersColl.find(query).toArray();

        if (find.length > 0) {
          // Check if any results are returned
          return res.send("User already exists");
        }
      }

      const addEmail = await usersColl.insertOne(req.body);
      res.send("user succesfuly added");
    });

    app.get("/menu", async (req, res) => {
      const query = { email: req.body.email };
      const result = await menuColl.find(query).toArray();
      res.send(result);
      // console.log(result)
    });

    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuColl.find(query).toArray();
      res.send(result);
      // console.log(result)
    });

    //updated items of menu
    app.post("/menu/updatemenu/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id)
      const query = { _id: new ObjectId(id) };
      const name = req.body.name;
      const price = req.body.price;
      const recipe = req.body.recipe;
      const image = req.body.image;

      // console.log(name,price,recipe,image)

      const doc = {
        $set: {
          name: name,
          price: price,
          recipe: recipe,
          image: image,
        },
      };

      const result = await menuColl.updateOne(query, doc);
      console.log(result);
      res.send(result);
    });

    //delete menu items
    app.post("/menu/delete", async (req, res) => {
      const query = { _id: new ObjectId(req.query.id) };
      const result = await menuColl.deleteOne(query);
      console.log(result);
      res.send(result);
    });

    app.post("/carts", async (req, res) => {
      const data = req.body;
      const result = await CartColl.insertOne(data);
      res.send("data send successfully");
    });

    app.get("/carts", async (req, res) => {
      const query = { email: req.query.email };
      const result = await CartColl.find(query).toArray();
      res.send(result);
    });
    app.post("/delete", async (req, res) => {
      const id = req.query.id;

      if (!id || !ObjectId.isValid(id)) {
        return res.status(400).send("invalid or missing ID");
      }

      const query = { _id: new ObjectId(id) };
      const result = await CartColl.deleteOne(query);

      if (result.deletedCount === 0) {
        return res.status(404).send("item not found");
      }

      res.send("successfully deleted ");
    });

    //deleting the user admin power
    app.post("/deleteuser/:id", async (req, res) => {
      const id = req.params.id;
      const doc = { _id: new ObjectId(id) };
      const resultDelete = await usersColl.deleteOne(doc);
      res.send(resultDelete);
      // console.log(resultDelete);
    });

    //making admin role endpoint
    app.post("/makeAdmin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };

      const result = await usersColl.updateOne(filter, updateDoc);
      res.send(result);

      // console.log(result)
    });

    //adding adminhome status..
    app.get("/adminstatus", async (req, res) => {
      //geting all the reveneu
      const totalRevenue = await PaymentHistoryColl.aggregate([
        {
          $group: {
            _id: null,
            totalPrice: { $sum: "$price" },
          },
        },
        {
          $project: {
            _id: 0,
            totalPrice: 1,
          },
        },
      ]).toArray(); // Convert the cursor to an array

      // getting user length
      const user = await usersColl.find().toArray();
      const userLength = user.length;

      //getting all menus
      const Menus = await menuColl.find().toArray();
      const allProduct = Menus.length;

      //orders list
      const orders = await PaymentHistoryColl.find().toArray();
      const allOrders = orders.length;

      res.json({ totalRevenue, userLength, allProduct, allOrders }); // Send the first element of the array if you expect only one result
    });

    //order charts status data
    app.get("/adminOrderStatus", async (req, res) => {
      //   const result= await PaymentHistoryColl.aggregate([{

      //     $lookup :{
      //       from:"menu",
      //       localField:"menuItemId",
      //       foreignField:"_id",
      //       as:"menuDetails"

      //     }

      //   },
      //   {
      //     $project:{
      //       _id: 0,
      //       email: 1,
      //       price: 1,
      //       data: 1,
      //       menuDetails:{
      //         name:1,
      //         price:1,
      //         category:1
      //       }
      //     }
      //   }

      // ]).toArray()

      const { ObjectId } = require("mongodb");

      const result = await PaymentHistoryColl.aggregate([
        {
          $unwind: "$menuItemId",
        },
        {
          $addFields: {
            menuItemId: {
              $convert: {
                input: "$menuItemId",
                to: "objectId",
                onError: null,
                onNull: null,
              },
            },
          },
        },
        {
          $lookup: {
            from: "menu",
            localField: "menuItemId",
            foreignField: "_id",
            as: "menuItems",
          },
        },

        {
          $unwind: "$menuItems",
        },
        {
          $group: {
            _id: "$menuItems.category",
            quantity: {$sum: 1},
            revenue:{$sum:'$menuItems.price'}
          },
        },
        {
          $project:{
            _id:0,
            category:'$_id',
            quantity:'$quantity',
            totalRevenue:'$revenue'
          }
        }


      ]).toArray();

      res.send(result);
    });

    //jwt releted api
    app.post("/jwt", async (req, res) => {
      try {
        const data = req.body.email;

        // Check if the email is provided
        if (!data) {
          return res.status(400).send({ message: "Email is required" });
        }

        console.log(data);
        // Sign the JWT token with the email and expiration time
        const token = jwt.sign({ email: data }, process.env.PRIVATE_KEY, {
          expiresIn: "24h", // Set expiration to 24 hours
        });

        // Send token as a response
        res.send({ token });
      } catch (error) {
        // Catch any errors and respond with a status code and message
        console.error("Error generating JWT token:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // adding strip backend system
    // Create Payment Intent
    app.post("/create-payment-intent", async (req, res) => {
      try {
        const { price } = req.body;
        const amount = parseInt(price * 100);

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount, // Amount in the smallest currency unit (e.g., cents for USD)
          currency: "usd",
          payment_method_types: ["card"],
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
        console.log(paymentIntent.client_secret);
      } catch (error) {
        res.status(500).send({ error: error.message });
        console.log(error);
      }
    });

    //saving payment to database mongodb
    app.post("/payments", async (req, res) => {
      try {
        const payment = req.body;
        const completePayment = await PaymentHistoryColl.insertOne(payment);
        console.log("payment info", completePayment);

        //after adding it in payment history we delete it
        const deletedCartId = req.body.cartId;
        const objectIds = deletedCartId.map((id) => new ObjectId(id));
        const query = {
          _id: {
            $in: objectIds,
          },
        };

        const deleteCart = CartColl.deleteMany(query);
        console.log("cart id :", deleteCart);

        res.status(200).send(completePayment); // Send a success response
      } catch (error) {
        console.error("Error saving payment:", error);
        res.status(500).send({ message: "Internal Server Error", error }); // Send error response
      }
    });

    //adding payment history pages
    // Assuming you're using MongoDB's native driver

    // Connect to MongoDB and fetch payment history

    app.post("/paymenthistory/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const query = { email: email };
        console.log(query);
        // Fetch payment history from the native MongoDB driver

        const results = await PaymentHistoryColl.find(query).toArray(); // Native MongoDB query
        if (results.length > 0) {
          res.status(200).json(results); // Send the results as JSON
        } else {
          res
            .status(404)
            .json({ message: "No payment history found for this email" });
        }

        console.log(results); // Log results for debugging
      } catch (error) {
        console.error("Error fetching payment history:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    //end of finished line ...
  } catch (error) {
    console.log(error);
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
