import { SNS } from 'aws-sdk' // eslint-disable-line import/no-extraneous-dependencies

export default class SnsPubSub<Payload> {
  static client = new SNS({ apiVersion: '2010-03-31' })

  private topicArn: string

  constructor(topicArn: string) {
    this.topicArn = topicArn
  }

  async subscribe(endpoint: string) {
    await SnsPubSub.client
      .subscribe({
        TopicArn: this.topicArn,
        Protocol: 'https',
        Endpoint: endpoint,
      })
      .promise()
  }

  async confirmSubscription(token: string) {
    await SnsPubSub.client
      .confirmSubscription({
        Token: token,
        TopicArn: this.topicArn,
      })
      .promise()
  }

  async publish(message: Payload) {
    await SnsPubSub.client
      .publish({
        Message: JSON.stringify(message),
        TopicArn: this.topicArn,
      })
      .promise()
  }
}
