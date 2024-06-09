const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_SECRET_KEY}@cluster0.dr6rgwa.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db("newspaper").collection("users");
    const articlesCollection = client.db("newspaper").collection("articles");
    const publisherCollection = client.db("newspaper").collection("publishers");



    // user related API
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exist' })
      }
      const result = await userCollection.insertOne(user);
      res.send(result)
    })

    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result)
    })

    app.put("/update-payment", async (req, res) => {
      const { email, time } = req.body;
      const query = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          premiumTaken: time
        },
      };
      const result = await userCollection.updateOne(query, updateDoc, options);
      res.send(result)
    })

    app.put("/update-user-premium/:email", async (req, res) => {
      const { email } = req.params;
      const query = { email: email };
      const updateDoc = {
        $set: {
          premiumTaken: null,
        },
      };
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result)
    })

    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result)
    })



    // articles related API
    app.post("/articles", async (req, res) => {
      const article = req.body;
      const result = await articlesCollection.insertOne(article);
      res.send(result)
    })

    app.get("/articles", async (req, res) => {
      const query = { status: "approved" }
      const result = await articlesCollection.find(query).toArray();
      res.send(result)
    })

    app.get("/details/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await articlesCollection.findOne(query);
      res.send(result)
    })

    app.get("/my-articles/:email", async (req, res) => {
      const email = req.params.email;
      const query = { author: email }
      const result = await articlesCollection.find(query).toArray();
      res.send(result)
    })

    app.delete("/delete-article/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await articlesCollection.deleteOne(query);
      res.send(result)
    })

    app.put("/update-article/:id", async (req, res) => {
      const id = req.params.id;
      const { title, publisher, tags, photo, description } = req.body;
      const query = { _id: new ObjectId(id) }
      console.log(req.body);
      const updateDoc = {
        $set: {
          title: title,
          publisher: publisher,
          tags: tags.map(tag => tag),
          photo: photo,
          description: description
        },
      };
      const result = await articlesCollection.updateOne(query, updateDoc);
      res.send(result)
    })

    // app.put('/news/:id', async (req, res) => {
    //   const articleId = req.params.id;

    //   // try {
    //     const result = await articlesCollection.findOneAndUpdate(
    //       { _id: ObjectId(articleId) },
    //       { $inc: { count: 1 } },
    //       // { returnDocument: 'after' }
    //     );

    //     if (!result.value) {
    //       return res.status(404).send('Article not found');
    //     }

    //     res.send(result.value);
    // //   } catch (error) {
    // //     res.status(500).send('Server error');
    // //   }
    // });

    // API endpoint to increment view count
    app.put('/news/:id', async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $inc: {
          count: 1
        }
      };

      try {
        const result = await articlesCollection.updateOne(query, updateDoc);
        if (result.matchedCount === 0) {
          return res.status(404).send('Article not found');
        }
        res.status(200).send(result);
      } catch (error) {
        console.error('Error updating view count:', error);
        res.status(500).send('Internal Server Error');
      }
    });


    // payment related API
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });



    // admin related api
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { role: "admin", email: email }
      const result = await userCollection.find(query).toArray();
      res.send(result)
    })

    app.put("/update-user-role/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result)
    })

    app.get("/all-articles", async (req, res) => {
      // const query = { role: "user" }
      const result = await articlesCollection.find().toArray();
      res.send(result)
    })

    app.put("/update-article-premium/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          isPremium: "yes",
        },
      };
      const result = await articlesCollection.updateOne(query, updateDoc);
      res.send(result)
    })

    app.put("/approve-article/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          status: "approved",
        },
      };
      const result = await articlesCollection.updateOne(query, updateDoc);
      res.send(result)
    })

    app.delete("/delete-article/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await articlesCollection.deleteOne(query);
      res.send(result)
    })

    app.put("/reason-decline/:id", async (req, res) => {
      const { id } = req.params;
      const { reason } = req.body;
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          declineReason: reason,
          status: "declined"
        },
      };
      const result = await articlesCollection.updateOne(query, updateDoc, options);
      res.send(result)
    })






    // publisher related API
    app.post("/publishers", async (req, res) => {
      const publisher = req.body;
      const result = await publisherCollection.insertOne(publisher);
      res.send(result)
    })

    app.get("/publishers", async (req, res) => {
      const result = await publisherCollection.find().toArray();
      res.send(result)
    })





    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})