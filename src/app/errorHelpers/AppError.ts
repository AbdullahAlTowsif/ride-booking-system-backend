class AppError extends Error {
    public statusCode: number;
    constructor(statusCode: number, message: string, stack = '') {
        super(message) // throw new Error("Something went wrong")
        this.statusCode = statusCode

        // this is our stack
        if(stack) {
            this.stack = stack
        }
        // this is default stack from Error class
        else {
            Error.captureStackTrace(this, this.constructor)
        }
    }
}

export default AppError;
