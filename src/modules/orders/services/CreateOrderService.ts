import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('User not found');
    }

    const findProducts = await this.productsRepository.findAllById(products);

    if (!findProducts) {
      throw new AppError('Product not found');
    }

    const findProductsInStock = products.every(product => {
      const findedProduct = findProducts.find(
        storedProduct => storedProduct.id === product.id,
      );

      return product.quantity < (findedProduct?.quantity || 0);
    });

    if (!findProductsInStock) {
      throw new AppError('Insufficient product stock');
    }

    const orderProducts = products.map(product => {
      const findedProduct = findProducts.find(
        storedProduct => storedProduct.id === product.id,
      );

      return {
        product_id: product.id,
        quantity: product.quantity,
        price: findedProduct?.price || 0,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: orderProducts,
    });

    await this.productsRepository.updateQuantity(products);

    return order;
  }
}

export default CreateOrderService;
