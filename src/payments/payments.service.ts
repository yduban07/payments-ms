import { Injectable } from '@nestjs/common';
import { envs } from 'src/config';
import Stripe from 'stripe';
import { PaymentSessionDto } from './dto/payment-session.dto';
import { Request, Response } from 'express';

@Injectable()
export class PaymentsService {

    private readonly stripe =  new Stripe(envs.stripeSecret);

    async createPaymentSession( paymentSessionDto: PaymentSessionDto ) {

        const { currency, items, orderId } = paymentSessionDto;

        const lineItems = items.map(item =>  {
            return {
                price_data: {
                    currency: currency,
                    product_data: {
                        name: item.name
                    },
                    unit_amount: Math.round( item.price * 100 ) // 20 dollars => 2000 / 100
                },
                quantity: item.quantity
            }
        });

        const session = await this.stripe.checkout.sessions.create({
            payment_intent_data: {
                metadata: {
                    orderId: orderId
                }
            }, 
            line_items: lineItems,
            mode: 'payment',
            success_url: envs.stripeSuccessUrl,
            cancel_url: envs.stripeCancelUrl,
        });

        return session;
    }

    async stripeWebhook(req: Request, res: Response){
        const sig = req.headers['stripe-signature'];

        let event: Stripe.Event;
        //const endpointSecret = 'whsec_bf1f0811ba980a71919291a49baef654562e6995a264d97a545646c698435789';
        //const endpointSecret = 'whsec_IxLgAnetwCcU5jOFs4RTne5OitPuorpj';
        const endpointSecret = envs.stripeEndpointSecret;

        
        try {
            event = this.stripe.webhooks.constructEvent(req['rawBody'], sig , endpointSecret);

        } catch (error) {
            console.log(`Webhook Error: ${error.message}`);
            res.status(400).send(`Webhook Error: ${error.message}`);
            return;
        }

        switch(event.type){
            case 'charge.succeeded':
                const chargeSucceeded =  event.data.object;

                console.log({
                    metadata: chargeSucceeded.metadata
                });
            break;
            default:
                console.log(`Event ${event.type} not handled`);
        }

       return res.status(200).json({sig});

    
    } 
}
