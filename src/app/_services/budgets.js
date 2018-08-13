export default [
    {
        value: '1',
        id: '1',
        min_sum: '12',
        max_sum: '30',
        currency: 'USD',
        get label() {
            return 'Micro Project ( $' + this.min_sum + ' - ' + this.max_sum + ' ' + this.currency + ')';
        },
    },
    {
        value: '2',
        id: '2',
        min_sum: '30',
        max_sum: '250',
        currency: 'USD',
        get label() {
            return 'Simple project ( $' + this.min_sum + ' - ' + this.max_sum + ' ' + this.currency + ')';
        },
    },
    {
        value: '3',
        id: '3',
        min_sum: '250',
        max_sum: '750',
        currency: 'USD',
        get label() {
            return 'Very small project ( $' + this.min_sum + ' - ' + this.max_sum + ' ' + this.currency + ')';
        },
    },
    {
        value: '4',
        id: '4',
        min_sum: '750',
        max_sum: '1500',
        currency: 'USD',
        get label() {
            return 'Small project ( $' + this.min_sum + ' - ' + this.max_sum + ' ' + this.currency + ')';
        },
    },
    {
        value: '5',
        id: '5',
        min_sum: '1500',
        max_sum: '3000',
        currency: 'USD',
        get label() {
            return 'Medium project ( $' + this.min_sum + ' - ' + this.max_sum + ' ' + this.currency + ')';
        },
    },
    {
        value: '6',
        id: '6',
        min_sum: '3000',
        max_sum: '5000',
        currency: 'USD',
        get label() {
            return 'Large project ( $' + this.min_sum + ' - ' + this.max_sum + ' ' + this.currency + ')';
        },
    },
    {
        value: '7',
        id: '7',
        min_sum: '5000',
        max_sum: '10000',
        currency: 'USD',
        get label() {
            return 'Larger project ( $' + this.min_sum + ' - ' + this.max_sum + ' ' + this.currency + ')';
        },
    },
    {
        value: '8',
        id: '8',
        min_sum: '10000',
        max_sum: '20000',
        currency: 'USD',
        get label() {
            return 'Very Large project ( $' + this.min_sum + ' - ' + this.max_sum + ' ' + this.currency + ')';
        },
    },
    {
        value: '9',
        id: '9',
        min_sum: '20000',
        max_sum: '50000',
        currency: 'USD',
        get label() {
            return 'Huge project ( $' + this.min_sum + ' - ' + this.max_sum + ' ' + this.currency + ')';
        },
    },
    {
        value: '10',
        id: '10',
        min_sum: '50000',
        max_sum: null,
        currency: 'USD',
        get label() {
            return 'Major project ( $' + this.min_sum + '+ ' + this.currency + ')';
        },
    },
];
