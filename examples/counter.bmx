:props: count: Int
:!props:

# Counter

The count is {{ to_string(count) }}.

:button: on:click=count + 1
increment
:!button:

:button: on:click=0
reset
:!button:
