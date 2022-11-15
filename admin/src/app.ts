import * as express from "express";
import { Request, Response } from "express";
import * as cors from "cors";
import { DataSource } from "typeorm";
import { Product } from "./entity/product";
import * as amqp from "amqplib/callback_api";

const db = new DataSource({
  type: "mysql",
  host: "localhost",
  port: 3306,
  username: "root",
  password: "Admin123!@#",
  database: "m_b_admin",
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

          /* Routes */

          app.get("/api/products", async (req: Request, res: Response) => {
            const products = await productRepository.find();
            res.json(products);
          });

          app.post("/api/products", async (req: Request, res: Response) => {
            const product = productRepository.create(req.body);

            const result = await productRepository.save(product);

            channel.sendToQueue(
              "product_created",
              Buffer.from(JSON.stringify(result))
            );

            return res.send(result);
          });

          app.get("/api/products/:id", async (req: Request, res: Response) => {
            const product = await productRepository.findOne({
              where: { id: +req.params.id },
            });

            return res.send(product);
          });

          app.patch(
            "/api/products/:id",
            async (req: Request, res: Response) => {
              const product = await productRepository.findOne({
                where: { id: +req.params.id },
              });

              productRepository.merge(product, req.body);

              const result = await productRepository.save(product);

              channel.sendToQueue(
                "product_updated",
                Buffer.from(JSON.stringify(result))
              );

              return res.send(result);
            }
          );

          app.delete(
            "/api/products/:id",
            async (req: Request, res: Response) => {
              await productRepository.delete(req.params.id);

              channel.sendToQueue(
                "product_deleted",
                Buffer.from(JSON.stringify(req.params.id))
              );

              return res.send("Product has been deleted");
            }
          );

          app.post(
            "/api/products/:id/like",
            async (req: Request, res: Response) => {
              const product = await productRepository.findOne({
                where: { id: +req.params.id },
              });
              product.likes++;

              const result = await productRepository.save(product);
              return res.send(result);
            }
          );

          app.listen(8000, () => {
            console.log("Admin api is running");
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
