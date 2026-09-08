param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)
& python -m uvicorn @Args
