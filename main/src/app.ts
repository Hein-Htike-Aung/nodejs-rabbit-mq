import * as express from "express";
import { Request, Response } from "express";
import * as cors from "cors";
import { DataSource } from "typeorm";
import { Product } from "./entity/product";
import * as amqp from "amqplib/callback_api";
import axios from "axios";

const db = new DataSource({
  type: "mysql",
  host: "localhost",
  port: 3306,
  username: "root",
  password: "Admin123!@#",
  database: "m_b_main",
  entities: ["src/entity/*.js"],
  synchronize: true,
});

db.initialize()
  .then(() => {
    const productRepository = db.getRepository(Product);

    /* RabbitMQ */
    amqp.connect(
      "amqps://bgpcoxut:BRFY58iQ56EESt80aK5F1ggfeu7_Xtin@gerbil.rmq.cloudamqp.com/bgpcoxut",
      (error0, connection) => {
        if (error0) throw error0;

        connection.createChannel((error1, channel) => {
          if (error1) throw error1;

          /* Channel */
          channel.assertQueue("product_created");
          channel.assertQueue("product_updated");
          channel.assertQueue("product_deleted");

          app.use(
            cors({
              origin: [
                "http://localhost:3000",
                "http://localhost:8080",
                "http://localhost:4200",
              ],
            })
          );

          app.use(express.json());

          /* Consumers */
          channel.consume(
            "product_created",
            async (msg) => {
              const eventProduct: Product = JSON.parse(msg.content.toString());

              const product = new Product();
              product.admin_id = eventProduct.id;
              product.title = eventProduct.title;
              product.image = eventProduct.image;
              product.likes = eventProduct.likes;

              await productRepository.save(product);

              console.log("product created in main");
            },
            { noAck: true }
          );

          channel.consume(
            "product_updated",
            async (msg) => {
              const eventProduct: Product = JSON.parse(msg.content.toString());

              const product = await productRepository.findOne({
                where: { admin_id: eventProduct.id },
              });

              productRepository.merge(product, {
                title: eventProduct.title,
                image: eventProduct.image,
                likes: eventProduct.likes,
              });

              await productRepository.save(product);

              console.log("product updated in main");
            },
            { noAck: true }
          );

          channel.consume(
            "product_deleted",
            async (msg) => {
              const eventAdmInId = JSON.parse(msg.content.toString());

              await productRepository.delete({ admin_id: eventAdmInId });

              console.log("product deleted in main");
            },
            { noAck: true }
          );

          /* Routes */

          app.get("/api/products", async (req: Request, res: Response) => {
            const products = await productRepository.find();
            return res.send(products);
          });

          app.get(
            "/api/products/:id/like",
            async (req: Request, res: Response) => {
              const product = await productRepository.findOne({
                where: { id: +req.params.id },
              });

              // API CALL TO ANOTHER SERVICE
              await axios.post(
                `http://localhost:8000/api/products/${product.admin_id}/like`,
                {}
              );
              product.likes++;

              const result = await productRepository.save(product);
              return res.send(result);
            }
          );

          app.listen(8001, () => {
            console.log("Main api is running");
          });
          process.on("beforeExit", () => {
            console.log("closing");
            connection.close();
          });
        });
      }
    );

    const app = express();
  })
  .catch((error) => console.log(error));
